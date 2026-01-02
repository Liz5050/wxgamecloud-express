const os = require('os');
const { performance, PerformanceObserver } = require('perf_hooks');

class PerformanceMonitor {
    constructor() {
        this.memoryUsageThreshold = 0.8; // 80%内存使用率阈值
        this.cpuUsageThreshold = 0.7; // 70% CPU使用率阈值
        this.metrics = {
            memory: [],
            cpu: [],
            responseTimes: []
        };
        
        this.setupPerformanceMonitoring();
    }
    
    setupPerformanceMonitoring() {
        // 每30秒收集一次性能指标
        setInterval(() => {
            this.collectMetrics();
        }, 30000);
        
        // 每5分钟清理一次旧数据
        setInterval(() => {
            this.cleanupOldMetrics();
        }, 300000);
        
        // 每15分钟定期清理内存和缓存，即使内存使用率未达到阈值
        setInterval(() => {
            this.performRegularCleanup();
        }, 900000);
    }
    
    // 定期执行的内存清理
    performRegularCleanup() {
        console.log('📅 执行定期内存清理');
        
        // 清理应用缓存
        this.clearMemoryCaches();
        
        // 执行垃圾回收（如果可用）
        if (global.gc) {
            global.gc();
            console.log('🧹 执行定期垃圾回收');
        }
        
        // 记录清理后的内存状态
        const memoryUsage = process.memoryUsage();
        console.log('📊 定期清理后内存状态:', {
            heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
            heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + 'MB'
        });
    }
    
    collectMetrics() {
        // 内存使用情况
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsage = usedMem / totalMem;
        
        this.metrics.memory.push({
            timestamp: Date.now(),
            usage: memoryUsage,
            total: totalMem,
            free: freeMem
        });
        
        // 基于内存使用率的分级垃圾回收和清理策略
        if (memoryUsage > this.memoryUsageThreshold) {
            // 80%以上：紧急内存压力处理
            console.warn(`⚠️  内存使用率过高: ${(memoryUsage * 100).toFixed(2)}% - 执行紧急清理`);
            this.handleMemoryPressure();
            this.clearMemoryCaches();
        } else if (memoryUsage > this.memoryUsageThreshold - 0.15) {
            // 65%以上：中等内存压力处理
            console.warn(`⚠️  内存使用率偏高: ${(memoryUsage * 100).toFixed(2)}% - 执行常规清理`);
            this.clearMemoryCaches();
            
            // 执行垃圾回收
            if (global.gc) {
                global.gc();
                console.log('🧹 执行中等压力垃圾回收');
            }
        } else if (memoryUsage > this.memoryUsageThreshold - 0.25) {
            // 55%以上：轻量内存压力处理
            console.log(`ℹ️  内存使用率正常偏高: ${(memoryUsage * 100).toFixed(2)}% - 执行轻量清理`);
            this.clearMemoryCaches();
        }
    }
    
    handleMemoryPressure() {
        // 优化的垃圾回收策略
        if (global.gc) {
            try {
                const beforeGc = process.memoryUsage();
                global.gc();
                const afterGc = process.memoryUsage();
                
                const freedMemoryMB = ((beforeGc.heapUsed - afterGc.heapUsed) / 1024 / 1024).toFixed(2);
                console.log(`🧹 执行强制垃圾回收: 释放 ${freedMemoryMB} MB 内存`);
                
                // 记录垃圾回收效果
                this.metrics.gc = this.metrics.gc || [];
                this.metrics.gc.push({
                    timestamp: Date.now(),
                    freedMemoryMB: parseFloat(freedMemoryMB),
                    heapUsedBefore: beforeGc.heapUsed,
                    heapUsedAfter: afterGc.heapUsed
                });
                
                // 如果垃圾回收效果不理想，考虑更激进的清理策略
                if (parseFloat(freedMemoryMB) < 10) {
                    console.log('⚠️  垃圾回收效果不佳，执行额外清理');
                    this.clearModuleCache();
                    this.clearMemoryCaches();
                }
            } catch (error) {
                console.error('执行垃圾回收失败:', error);
            }
        }
        
        // 清理模块缓存（谨慎使用）
        this.clearModuleCache();
    }
    
    clearMemoryCaches() {
        // 清理应用级别的缓存
        try {
            // 在需要时动态导入app模块，避免循环依赖问题
            let appModule;
            try {
                // 使用try-catch包装require，防止循环依赖导致的错误
                appModule = require('../app');
                // 注意：不保存到实例属性，避免持有未完全初始化的模块引用
            } catch (requireError) {
                console.debug('动态导入app模块失败（可能是循环依赖导致）:', requireError.message);
                return;
            }
            
            // 安全地检查rankCache属性是否存在且可用
            // 使用更严格的检查方式，避免在模块未完全初始化时访问属性
            if (appModule && typeof appModule === 'object' && 
                appModule !== null && 
                Object.prototype.hasOwnProperty.call(appModule, 'rankCache') && 
                typeof appModule.rankCache === 'object' && 
                appModule.rankCache !== null && 
                typeof appModule.rankCache.clear === 'function') {
                const cacheSizeBefore = appModule.rankCache.size;
                appModule.rankCache.clear();
                const cacheSizeAfter = appModule.rankCache.size;
                console.log(`🧹 清理排行榜缓存: 移除 ${cacheSizeBefore - cacheSizeAfter} 个条目`);
            }
            
            // 安全地检查cacheExpiry属性是否存在且可用
            if (appModule && typeof appModule === 'object' && 
                appModule !== null && 
                Object.prototype.hasOwnProperty.call(appModule, 'cacheExpiry') && 
                typeof appModule.cacheExpiry === 'object' && 
                appModule.cacheExpiry !== null && 
                typeof appModule.cacheExpiry.clear === 'function') {
                appModule.cacheExpiry.clear();
                console.log('🧹 清理缓存过期时间记录');
            }
        } catch (error) {
            // 忽略循环依赖或其他导入错误
            console.debug('清理应用缓存失败:', error.message);
        }
        
        // 清理其他可能的缓存
        console.log('🧹 清理内存缓存完成');
    }
    
    clearModuleCache() {
        // 谨慎清理模块缓存，可能会影响性能
        Object.keys(require.cache).forEach(key => {
            // 避免清理核心模块
            if (!key.includes('node_modules') && !key.includes('internal')) {
                delete require.cache[key];
            }
        });
    }
    
    cleanupOldMetrics() {
        const now = Date.now();
        const oneHour = 3600000;
        
        // 清理1小时前的数据
        this.metrics.memory = this.metrics.memory.filter(m => 
            now - m.timestamp < oneHour
        );
        
        this.metrics.cpu = this.metrics.cpu.filter(m => 
            now - m.timestamp < oneHour
        );
        
        this.metrics.responseTimes = this.metrics.responseTimes.filter(m => 
            now - m.timestamp < oneHour
        );
    }
    
    trackResponseTime(startTime, route) {
        const duration = performance.now() - startTime;
        this.metrics.responseTimes.push({
            timestamp: Date.now(),
            route,
            duration
        });
        
        // 记录慢查询（超过500ms）
        if (duration > 500) {
            console.warn(`🐌 慢响应: ${route} - ${duration.toFixed(2)}ms`);
        }
        
        return duration;
    }
    
    getPerformanceReport() {
        const memoryStats = this.getMemoryStats();
        const responseTimeStats = this.getResponseTimeStats();
        
        return {
            memory: memoryStats,
            responseTimes: responseTimeStats,
            timestamp: Date.now()
        };
    }
    
    getMemoryStats() {
        if (this.metrics.memory.length === 0) return null;
        
        const latest = this.metrics.memory[this.metrics.memory.length - 1];
        const avgUsage = this.metrics.memory.reduce((sum, m) => sum + m.usage, 0) / this.metrics.memory.length;
        
        return {
            current: (latest.usage * 100).toFixed(2) + '%',
            average: (avgUsage * 100).toFixed(2) + '%',
            total: this.formatBytes(latest.total),
            free: this.formatBytes(latest.free)
        };
    }
    
    getResponseTimeStats() {
        if (this.metrics.responseTimes.length === 0) return null;
        
        const avgDuration = this.metrics.responseTimes.reduce((sum, rt) => sum + rt.duration, 0) / this.metrics.responseTimes.length;
        const slowRequests = this.metrics.responseTimes.filter(rt => rt.duration > 500).length;
        
        return {
            totalRequests: this.metrics.responseTimes.length,
            averageResponseTime: avgDuration.toFixed(2) + 'ms',
            slowRequests,
            slowRequestPercentage: ((slowRequests / this.metrics.responseTimes.length) * 100).toFixed(2) + '%'
        };
    }
    
    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }
}

// 创建中间件来跟踪响应时间
function createPerformanceMiddleware(monitor) {
    return (req, res, next) => {
        const startTime = performance.now();
        
        // 在响应发送前设置响应头
        res.setHeader('X-Response-Time', '0ms');
        
        res.on('finish', () => {
            const duration = monitor.trackResponseTime(startTime, req.path);
            
            // 记录慢API
            if (duration > 1000) {
                console.warn(`🚨 非常慢的API: ${req.method} ${req.path} - ${duration.toFixed(2)}ms`);
            }
        });
        
        next();
    };
}

module.exports = {
    PerformanceMonitor,
    createPerformanceMiddleware
};