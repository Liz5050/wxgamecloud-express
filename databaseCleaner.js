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
            // 僵尸用户定义：30天未活跃
            zombieUserThreshold: 30 * 24 * 60 * 60 * 1000, // 30天
            
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
                user_data: 20000,         // 2万条用户数据
                share_rewards: 20000      // 2万条分享奖励
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
    
    // 记录清理操作到文件（异步非阻塞）
    async logCleanupOperation(operationType, details) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp: timestamp,
            operation: operationType,
            ...details,
            // 移除详细的服务器信息以减少数据量
            memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        };
        
        // 简化用户详情信息，只保留必要数据
        if (logEntry.zombieUserDetails) {
            logEntry.zombieUserDetails = logEntry.zombieUserDetails.map(user => ({
                openid: user.openid.substring(0, 8) + '...', // 部分隐藏敏感信息
                score: user.score,
                skin_id: user.skin_id
                // 移除createdAt等不必要字段
            }));
        }
        
        const logFileName = `cleanup_${timestamp.replace(/:/g, '-')}.json`;
        const logFilePath = path.join(this.cleanupLogsDir, logFileName);
        
        try {
            // 使用异步写入，不阻塞事件循环
            await fs.promises.writeFile(logFilePath, JSON.stringify(logEntry));
            
            // 异步追加到汇总日志
            this.appendToSummaryLogAsync(logEntry);
            
        } catch (error) {
            console.error('写入清理日志失败:', error);
        }
    }
    
    // 异步追加到汇总日志（非阻塞）
    async appendToSummaryLogAsync(logEntry) {
        const summaryFile = path.join(this.cleanupLogsDir, 'cleanup_summary.jsonl');
        
        try {
            await fs.promises.appendFile(summaryFile, JSON.stringify(logEntry) + '\n');
        } catch (error) {
            console.error('写入汇总日志失败:', error);
        }
    }
    
    // 批量日志写入（性能优化）
    async batchLogCleanupOperations(operations) {
        if (operations.length === 0) return;
        
        const batchEntry = {
            timestamp: new Date().toISOString(),
            operation: 'batch_cleanup',
            totalOperations: operations.length,
            operations: operations.map(op => ({
                type: op.operation,
                deleted: op.totalDeleted || 0,
                memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
            }))
        };
        
        try {
            const logFileName = `batch_cleanup_${new Date().toISOString().replace(/:/g, '-')}.json`;
            const logFilePath = path.join(this.cleanupLogsDir, logFileName);
            
            await fs.promises.writeFile(logFilePath, JSON.stringify(batchEntry));
        } catch (error) {
            console.error('批量写入日志失败:', error);
        }
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
    
    // 清理僵尸用户数据（性能优化版）
    async cleanupZombieUsers() {
        console.log('🚀 开始清理僵尸用户数据...');
        
        try {
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
    
    // 启动定时清理任务
    startScheduledCleanup() {
        console.log('⏰ 启动定时数据库清理任务...');
        
        // 每天凌晨2点执行清理
        setInterval(async () => {
            try {
                await this.cleanupZombieUsers();
                await this.archiveOldData();
                
                // 记录性能指标
                const memoryUsage = process.memoryUsage();
                console.log('📊 内存使用情况:', {
                    heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
                    heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
                    rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + 'MB'
                });
                
            } catch (error) {
                console.error('定时清理任务失败:', error);
            }
        }, 24 * 60 * 60 * 1000); // 24小时
        
        // 立即执行一次
        setTimeout(() => {
            this.cleanupZombieUsers().catch(console.error);
        }, 5000);
    }
}

module.exports = DatabaseCleaner;