const { Sequelize, Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

class DatabaseCleaner {
    constructor(sequelize, models) {
        this.sequelize = sequelize;
        this.models = models;
        
        // 基于服务器性能参数的智能阈值配置
        // 内存使用率51.04%，平均响应时间19.65ms - 性能良好
        this.config = {
            // 僵尸用户定义：15天未活跃
            zombieUserThreshold: 15 * 24 * 60 * 60 * 1000, // 15天
            
            // 清理批次大小（基于服务器性能优化）
            batchSize: 100,
            
            // 执行间隔：每天凌晨2点执行
            cleanupSchedule: '0 2 * * *',
            
            // 内存使用率告警阈值（当前51.04%，设置75%告警）
            memoryAlertThreshold: 75,
            
            // 响应时间告警阈值（当前19.65ms，设置50ms告警）
            responseTimeAlertThreshold: 50,
            
            // 最大保留记录数（防止无限制增长）
            maxRecords: {
                user_game_data: 50000,    // 5万条游戏记录
                user_data: 10000,         // 1万条用户数据
                share_rewards: 10000      // 1万条分享奖励
            }
        };
        
        this.cleanupStats = {
            lastRun: null,
            totalCleaned: 0,
            lastCleaned: 0,
            errors: 0
        };
        
        // 清理记录目录
        this.cleanupLogsDir = path.join(__dirname, 'logs', 'cleanup');
        this.ensureLogsDirectory();
    }
    
    // 确保日志目录存在
    ensureLogsDirectory() {
        if (!fs.existsSync(this.cleanupLogsDir)) {
            fs.mkdirSync(this.cleanupLogsDir, { recursive: true });
        }
    }
    
    // 简化的日志记录，只保留控制台输出
    async logCleanupOperation(operationType, details) {
        // 只保留控制台日志，不再写入文件
        console.log(`📝 清理操作: ${operationType}`, {
            ...details,
            memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        });
    }
    
    // 移除批量日志写入，简化为控制台输出
    async batchLogCleanupOperations(operations) {
        if (operations.length === 0) return;
        
        console.log(`📝 批量清理操作完成，共 ${operations.length} 个批次`);
    }
    
    // 获取清理记录
    getCleanupLogs(limit = 50, offset = 0) {
        try {
            const files = fs.readdirSync(this.cleanupLogsDir)
                .filter(file => file.startsWith('cleanup_') && file.endsWith('.json'))
                .sort()
                .reverse();
            
            const logs = [];
            const start = offset;
            const end = Math.min(offset + limit, files.length);
            
            for (let i = start; i < end; i++) {
                const filePath = path.join(this.cleanupLogsDir, files[i]);
                const content = fs.readFileSync(filePath, 'utf8');
                logs.push(JSON.parse(content));
            }
            
            return {
                logs,
                total: files.length,
                hasMore: end < files.length
            };
            
        } catch (error) {
            console.error('读取清理日志失败:', error);
            return { logs: [], total: 0, hasMore: false };
        }
    }
    
    // 获取僵尸用户（30天未活跃）
    async getZombieUsers() {
        try {
            const thirtyDaysAgo = new Date(Date.now() - this.config.zombieUserThreshold);
            
            // 查找30天内没有游戏记录的用户
            const activeUsers = await this.models.user_game_data.findAll({
                attributes: ['openid'],
                where: {
                    record_time: {
                        [Op.gte]: thirtyDaysAgo
                    }
                },
                group: ['openid'],
                raw: true
            });
            
            const activeOpenIds = activeUsers.map(user => user.openid);
            
            // 查找所有用户，排除活跃用户
            const allUsers = await this.models.user_data.findAll({
                attributes: ['openid', 'score', 'skin_id', 'createdAt'],
                raw: true
            });
            
            return allUsers.filter(user => 
                !activeOpenIds.includes(user.openid)
            );
            
        } catch (error) {
            console.error('获取僵尸用户失败:', error);
            this.cleanupStats.errors++;
            return [];
        }
    }
    
    // 直接控制user_game_data表记录数量，确保不超过阈值
    async cleanupUserDataTable() {
        console.log('📊 开始检查并清理user_game_data表记录数量...');
        
        try {
            const tableSizes = await this.checkTableSizes();
            const userGameDataInfo = tableSizes.user_game_data;
            
            if (!userGameDataInfo) {
                console.log('❌ 无法获取user_game_data表信息');
                return 0;
            }
            
            console.log(`📊 user_game_data表当前状态: ${userGameDataInfo.current}/${userGameDataInfo.max} (${userGameDataInfo.percentage}%)`);
            
            // 如果未超过阈值，不需要清理
            if (!userGameDataInfo.exceeded) {
                console.log('✅ user_game_data表记录数量未超过阈值，无需清理');
                return 0;
            }
            
            // 计算需要删除的记录数
            const recordsToDelete = userGameDataInfo.current - userGameDataInfo.max;
            console.log(`⚠️  需要删除 ${recordsToDelete} 条记录以达到阈值`);
            
            // 获取需要保留的最新记录的ID边界
            const thresholdRecord = await this.models.user_game_data.findAll({
                attributes: ['id'],
                order: [['record_time', 'DESC']],
                limit: userGameDataInfo.max,
                offset: userGameDataInfo.max - 1,
                raw: true
            });
            
            if (thresholdRecord.length === 0) {
                console.log('❌ 无法确定需要保留的记录边界');
                return 0;
            }
            
            const thresholdId = thresholdRecord[0].id;
            
            // 分批删除旧记录
            let totalDeleted = 0;
            const batchSize = this.config.batchSize;
            
            while (totalDeleted < recordsToDelete) {
                // 计算当前批次删除数量（不超过剩余需要删除的数量）
                const currentBatchSize = Math.min(batchSize, recordsToDelete - totalDeleted);
                
                const deleted = await this.models.user_game_data.destroy({
                    where: {
                        id: {
                            [Op.lt]: thresholdId
                        }
                    },
                    limit: currentBatchSize
                });
                
                if (deleted === 0) break; // 没有更多记录可删除
                
                totalDeleted += deleted;
                console.log(`🗑️  已删除 ${deleted} 条旧游戏记录，累计删除 ${totalDeleted}/${recordsToDelete}`);
                
                // 短暂延迟，避免数据库压力过大
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            this.cleanupStats.totalCleaned += totalDeleted;
            this.cleanupStats.lastCleaned = totalDeleted;
            this.cleanupStats.lastRun = new Date();
            
            console.log(`✅ user_game_data表清理完成！总共删除 ${totalDeleted} 条旧记录`);
            
            // 记录清理操作
            await this.logCleanupOperation('user_game_data_size_control', {
                recordsToDelete,
                totalDeleted,
                remainingRecords: userGameDataInfo.current - totalDeleted,
                threshold: userGameDataInfo.max
            });
            
            return totalDeleted;
            
        } catch (error) {
            console.error('清理user_game_data表失败:', error);
            this.cleanupStats.errors++;
            return 0;
        }
    }
    
    // 清理僵尸用户数据（性能优化版）- 增加数量条件保护
    async cleanupZombieUsers(options = {}) {
        console.log('🚀 开始清理僵尸用户数据...');
        
        try {
            // 首先检查user_data表是否达到阈值
            const tableSizes = await this.checkTableSizes();
            const userDataInfo = tableSizes.user_data;
            
            // 如果user_data表数量未达到阈值，且不是手动调用（force=true），则不执行清理
            if (userDataInfo && !userDataInfo.exceeded && !options.force) {
                console.log(`✅ user_data表当前数量 ${userDataInfo.current}/${userDataInfo.max}，未达到阈值，跳过清理`);
                return 0;
            }
            
            const zombieUsers = await this.getZombieUsers();
            console.log(`发现 ${zombieUsers.length} 个僵尸用户`);
            
            if (zombieUsers.length === 0) {
                console.log('✅ 没有需要清理的僵尸用户');
                return 0;
            }
            
            const zombieOpenIds = zombieUsers.map(user => user.openid);
            let totalDeleted = 0;
            const logOperations = [];
            
            // 使用事务确保数据一致性
            await this.sequelize.transaction(async (t) => {
                // 分批删除游戏记录
                for (let i = 0; i < zombieOpenIds.length; i += this.config.batchSize) {
                    const batch = zombieOpenIds.slice(i, i + this.config.batchSize);
                    
                    const deleted = await this.models.user_game_data.destroy({
                        where: { openid: { [Op.in]: batch } },
                        transaction: t
                    });
                    
                    totalDeleted += deleted;
                    console.log(`🗑️  已删除 ${deleted} 条游戏记录`);
                    
                    // 收集日志操作，批量处理
                    logOperations.push({
                        operation: 'zombie_batch_cleanup',
                        totalDeleted: deleted,
                        batchSize: batch.length
                    });
                    
                    // 给数据库喘息时间（减少延迟时间）
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                // 删除用户数据
                const userDeleted = await this.models.user_data.destroy({
                    where: { openid: { [Op.in]: zombieOpenIds } },
                    transaction: t
                });
                
                console.log(`🗑️  已删除 ${userDeleted} 条用户数据`);
                totalDeleted += userDeleted;
                
                // 删除分享奖励数据
                const rewardDeleted = await this.models.share_rewards.destroy({
                    where: { openid: { [Op.in]: zombieOpenIds } },
                    transaction: t
                });
                
                console.log(`🗑️  已删除 ${rewardDeleted} 条分享奖励数据`);
                totalDeleted += rewardDeleted;
            });
            
            this.cleanupStats.totalCleaned += totalDeleted;
            this.cleanupStats.lastCleaned = totalDeleted;
            this.cleanupStats.lastRun = new Date();
            
            console.log(`✅ 清理完成！总共删除 ${totalDeleted} 条数据`);
            
            // 批量记录清理操作（减少IO次数）
            if (logOperations.length > 0) {
                await this.batchLogCleanupOperations(logOperations);
            }
            
            // 只记录摘要信息，减少数据量
            await this.logCleanupOperation('zombie_cleanup_summary', {
                zombieUsersCount: zombieUsers.length,
                totalDeleted,
                batchCount: Math.ceil(zombieOpenIds.length / this.config.batchSize),
                // 移除详细用户信息以减少数据量
                sampleUsers: zombieUsers.slice(0, 5).map(user => ({
                    openid: user.openid.substring(0, 8) + '...',
                    score: user.score
                }))
            });
            
            return totalDeleted;
            
        } catch (error) {
            console.error('清理僵尸用户失败:', error);
            this.cleanupStats.errors++;
            throw error;
        }
    }
    
    // 检查表记录数量是否超过阈值
    async checkTableSizes() {
        const results = {};
        
        try {
            for (const [tableName, maxRecords] of Object.entries(this.config.maxRecords)) {
                const count = await this.models[tableName].count();
                results[tableName] = {
                    current: count,
                    max: maxRecords,
                    exceeded: count > maxRecords,
                    percentage: ((count / maxRecords) * 100).toFixed(1)
                };
            }
            
            return results;
            
        } catch (error) {
            console.error('检查表大小失败:', error);
            return {};
        }
    }
    
    // 归档旧数据（性能优化版）
    async archiveOldData() {
        try {
            console.log('开始归档旧数据...');
            
            const archiveThreshold = new Date();
            archiveThreshold.setMonth(archiveThreshold.getMonth() - 6); // 6个月前
            
            const tablesToArchive = ['user_game_data', 'user_skins', 'game_sessions'];
            let archivedCount = 0;
            const tableSizes = {};
            
            // 使用事务处理整个归档过程
            const transaction = await this.sequelize.transaction();
            
            try {
                for (const tableName of tablesToArchive) {
                    try {
                        // 检查归档表是否存在，不存在则跳过
                        const tableExists = await this.sequelize.query(`
                            SELECT EXISTS (
                                SELECT FROM information_schema.tables 
                                WHERE table_name = '${tableName}_archive'
                            ) as exists
                        `, { transaction });
                        
                        if (!tableExists[0][0].exists) {
                            console.log(`归档表 ${tableName}_archive 不存在，跳过`);
                            continue;
                        }
                        
                        // 批量归档，每次处理1000条
                        const batchSize = 1000;
                        let batchArchived = 0;
                        
                        while (true) {
                            const result = await this.sequelize.query(`
                                WITH moved_rows AS (
                                    DELETE FROM ${tableName} 
                                    WHERE created_at < ?
                                    RETURNING *
                                )
                                INSERT INTO ${tableName}_archive 
                                SELECT * FROM moved_rows
                                LIMIT ?
                            `, {
                                replacements: [archiveThreshold, batchSize],
                                transaction,
                                type: this.sequelize.QueryTypes.RAW
                            });
                            
                            if (result[1] === 0) break; // 没有更多数据
                            
                            batchArchived += result[1];
                            console.log(`表 ${tableName} 归档批次完成，归档 ${result[1]} 条记录`);
                            
                            // 短暂延迟
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }
                        
                        tableSizes[tableName] = batchArchived;
                        archivedCount += batchArchived;
                        
                        console.log(`表 ${tableName} 归档完成，总共归档 ${batchArchived} 条记录`);
                        
                    } catch (error) {
                        console.warn(`表 ${tableName} 归档失败:`, error.message);
                        // 继续处理其他表
                    }
                }
                
                await transaction.commit();
                
                if (archivedCount > 0) {
                    console.log(`数据归档完成，总共归档 ${archivedCount} 条记录`);
                    
                    // 异步记录归档操作
                    await this.logCleanupOperation('data_archiving', {
                        tablesArchived: tablesToArchive.filter(table => tableSizes[table] > 0),
                        totalArchived: archivedCount,
                        tableSizes: tableSizes,
                        archiveThreshold: archiveThreshold.toISOString().split('T')[0] // 只记录日期
                    });
                } else {
                    console.log('没有需要归档的数据');
                }
                
                return { archived: archivedCount };
                
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
            
        } catch (error) {
            console.error('数据归档失败:', error);
            throw error;
        }
    }
    
    // 获取清理统计信息
    getStats() {
        return {
            ...this.cleanupStats,
            config: this.config,
            nextRun: this.getNextRunTime()
        };
    }
    
    // 计算下次运行时间
    getNextRunTime() {
        // 简单的实现，实际可以使用node-schedule等库
        const now = new Date();
        const next = new Date(now);
        next.setDate(next.getDate() + 1);
        next.setHours(2, 0, 0, 0);
        return next;
    }
    
    // 启动定时清理任务 - 优化为每天执行一次，减少数据库连接使用
    startScheduledCleanup() {
        console.log('⏰ 启动定时数据库清理任务（每天凌晨2点执行）...');
        
        // 计算下次执行时间（每天凌晨2点）
        const calculateNextRun = () => {
            const now = new Date();
            const nextRun = new Date(now);
            nextRun.setHours(2, 0, 0, 0);
            nextRun.setMinutes(0);
            nextRun.setSeconds(0);
            nextRun.setMilliseconds(0);
            
            // 如果当前时间已过今天的2点，则设置为明天的2点
            if (nextRun <= now) {
                nextRun.setDate(nextRun.getDate() + 1);
            }
            
            return nextRun;
        };
        
        // 执行清理任务的函数
        const executeCleanup = async () => {
            try {
                console.log('🧹 开始执行定时数据库清理任务...');
                await this.cleanupZombieUsers({ force: false }); // 自动调用，不强制清理
                await this.cleanupUserDataTable(); // 控制user_game_data表记录数量
                // 移除 archiveOldData() 调用，减少数据库操作频率
                // await this.archiveOldData();
                
                // 记录性能指标
                const memoryUsage = process.memoryUsage();
                console.log('📊 清理后内存使用情况:', {
                    heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
                    heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
                    rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + 'MB'
                });
                
                console.log('✅ 定时数据库清理任务完成');
            } catch (error) {
                console.error('❌ 定时清理任务失败:', error);
            }
        };
        
        // 调度函数：计算下次执行时间并设置定时器
        const scheduleNextRun = () => {
            const nextRun = calculateNextRun();
            const msUntilNextRun = nextRun.getTime() - Date.now();
            
            console.log(`⏰ 下次清理任务执行时间: ${nextRun.toLocaleString('zh-CN')} (${Math.round(msUntilNextRun / 1000 / 60)}分钟后)`);
            
            setTimeout(async () => {
                await executeCleanup();
                // 递归调用，实现每天执行
                scheduleNextRun();
            }, msUntilNextRun);
        };
        
        // 启动调度
        scheduleNextRun();
        
        // 移除立即执行的清理任务，避免启动时立即建立数据库连接
        // 这样可以减少数据库连接的使用，降低MySQL算力成本
    }
}

module.exports = DatabaseCleaner;