class DatabaseOptimizer {
    constructor(sequelize) {
        this.sequelize = sequelize;
        this.queryCache = new Map();
        this.queryStats = new Map();
        this.slowQueryThreshold = 100; // 100ms
        
        this.setupQueryMonitoring();
    }
    
    setupQueryMonitoring() {
        // 监听所有查询
        this.sequelize.addHook('afterQuery', (options, query) => {
            this.trackQueryPerformance(query);
        });
        
        // 定期清理查询统计
        setInterval(() => {
            this.cleanupQueryStats();
        }, 3600000); // 每小时清理一次
    }
    
    trackQueryPerformance(query) {
        const { sql, duration } = query;
        
        if (!sql) return;
        
        // 简化SQL用于统计
        const simplifiedSql = this.simplifySql(sql);
        
        if (!this.queryStats.has(simplifiedSql)) {
            this.queryStats.set(simplifiedSql, {
                count: 0,
                totalDuration: 0,
                maxDuration: 0,
                minDuration: Infinity,
                lastExecuted: Date.now()
            });
        }
        
        const stats = this.queryStats.get(simplifiedSql);
        stats.count++;
        stats.totalDuration += duration;
        stats.maxDuration = Math.max(stats.maxDuration, duration);
        stats.minDuration = Math.min(stats.minDuration, duration);
        stats.lastExecuted = Date.now();
        
        // 记录慢查询
        if (duration > this.slowQueryThreshold) {
            console.warn(`🐌 慢SQL查询: ${duration.toFixed(2)}ms - ${simplifiedSql}`);
        }
    }
    
    simplifySql(sql) {
        // 移除具体值，保留SQL结构
        return sql
            .replace(/\b\d+\b/g, '?') // 替换数字
            .replace(/'.*?'/g, '?')    // 替换字符串
            .replace(/\s+/g, ' ')      // 压缩空格
            .trim();
    }
    
    cleanupQueryStats() {
        const now = Date.now();
        const oneDay = 86400000;
        
        for (const [sql, stats] of this.queryStats.entries()) {
            if (now - stats.lastExecuted > oneDay) {
                this.queryStats.delete(sql);
            }
        }
    }
    
    getQueryStatistics() {
        const stats = [];
        
        for (const [sql, data] of this.queryStats.entries()) {
            const avgDuration = data.totalDuration / data.count;
            
            stats.push({
                sql,
                count: data.count,
                avgDuration: avgDuration.toFixed(2),
                maxDuration: data.maxDuration.toFixed(2),
                minDuration: data.minDuration === Infinity ? '0' : data.minDuration.toFixed(2),
                totalDuration: data.totalDuration.toFixed(2)
            });
        }
        
        // 按执行次数排序
        return stats.sort((a, b) => b.count - a.count);
    }
    
    getSlowQueries() {
        return this.getQueryStatistics().filter(
            stat => parseFloat(stat.avgDuration) > this.slowQueryThreshold
        );
    }
    
    // 批量查询优化
    async batchFindAll(model, whereConditions, options = {}) {
        const { batchSize = 100, ...findOptions } = options;
        
        const results = [];
        let offset = 0;
        
        while (true) {
            try {
                const batch = await model.findAll({
                    where: whereConditions,
                    limit: batchSize,
                    offset,
                    ...findOptions
                });
                
                if (batch.length === 0) break;
                
                results.push(...batch);
                offset += batchSize;
                
                // 给事件循环喘息的机会
                if (offset % 500 === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }
                
            } catch (error) {
                console.error('批量查询错误:', error);
                throw error;
            }
        }
        
        return results;
    }
    
    // 连接池优化配置
    getPoolConfig() {
        return {
            max: 10,           // 最大连接数
            min: 2,            // 最小连接数
            acquire: 30000,    // 获取连接超时时间(ms)
            idle: 10000,       // 连接空闲时间(ms)
            evict: 1000,       // 驱逐检查间隔(ms)
            
            // 连接验证
            validate: (connection) => {
                return connection._isValid;
            },
            
            // 连接超时处理
            handleTimeout: (connection) => {
                connection.destroy();
            }
        };
    }
}

// 查询优化建议
const queryOptimizationTips = {
    'SELECT *': '避免使用SELECT *，只选择需要的字段',
    'LIKE %value%': '前导通配符LIKE查询无法使用索引',
    'OR condition': '考虑使用UNION替代OR条件',
    'ORDER BY RAND()': '避免使用ORDER BY RAND()，性能极差',
    'multiple JOIN': '检查JOIN是否必要，考虑 denormalization',
    'subquery': '检查子查询是否可以改为JOIN',
    'LIMIT large_offset': '大偏移量LIMIT查询性能差，考虑seek method'
};

module.exports = {
    DatabaseOptimizer,
    queryOptimizationTips
};