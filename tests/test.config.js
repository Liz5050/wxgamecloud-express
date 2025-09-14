// 测试配置文件 - 生产环境安全测试
module.exports = {
    // 测试环境配置
    testEnvironment: {
        baseURL: 'http://localhost:80', // 测试服务器地址
        timeout: 10000, // 请求超时时间(ms)
        maxRetries: 3, // 最大重试次数
        delayBetweenRequests: 500, // 请求间隔(ms)
    },

    // 安全测试配置
    safetyMeasures: {
        useTestDatabase: false, // 是否使用测试数据库（生产环境设为false）
        maxMemoryUsage: 500, // 最大内存使用限制(MB)
        maxResponseTime: 3000, // 最大响应时间限制(ms)
        enableBackup: true, // 是否启用数据备份
    },

    // 测试数据配置
    testData: {
        gameTypes: [1002, 1003, 1004], // 测试游戏类型
        subTypes: [0, 1, 2], // 测试子类型
        testUsers: 5, // 测试用户数量
        testScores: [100, 500, 1000, 2000], // 测试分数
    },

    // 监控配置
    monitoring: {
        checkInterval: 5000, // 监控检查间隔(ms)
        memoryThreshold: 80, // 内存使用率阈值(%)
        cpuThreshold: 70, // CPU使用率阈值(%)
    },

    // 测试场景配置
    testScenarios: {
        // 基础功能测试
        basic: {
            enabled: true,
            iterations: 1,
            endpoints: [
                '/api/performance',
                '/api/clear-cache',
                '/api/all_user_game_data/1002/0'
            ]
        },
        
        // 性能测试
        performance: {
            enabled: false, // 生产环境谨慎开启
            iterations: 10,
            concurrentRequests: 3,
            endpoints: [
                '/api/all_user_game_data/1002/0',
                '/api/user_game_data/1002/0'
            ]
        },

        // 压力测试
        stress: {
            enabled: false, // 生产环境不要开启
            iterations: 50,
            concurrentRequests: 10,
            endpoints: [
                '/api/all_user_game_data/1002/0'
            ]
        }
    }
};