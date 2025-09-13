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
        
        // 检查内存使用是否超过阈值
        if (memoryUsage > this.memoryUsageThreshold) {
            console.warn(`⚠️  内存使用率过高: ${(memoryUsage * 100).toFixed(2)}%`);
            this.handleMemoryPressure();
        }
        
        // 清理内存缓存（如果使用率过高）
        if (memoryUsage > this.memoryUsageThreshold - 0.1) {
            this.clearMemoryCaches();
        }
    }
    
    handleMemoryPressure() {
        // 强制垃圾回收（Node.js 需要启动时添加 --expose-gc 参数）
        if (global.gc) {
            global.gc();
            console.log('🧹 执行强制垃圾回收');
        }
        
        // 清理模块缓存（谨慎使用）
        this.clearModuleCache();
    }
    
    clearMemoryCaches() {
        // 这里可以清理应用级别的缓存
        // 例如：rankCache.clear() 等
        console.log('🧹 清理内存缓存');
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