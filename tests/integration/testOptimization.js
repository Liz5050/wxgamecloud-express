const axios = require('axios');
const { performance } = require('perf_hooks');

class OptimizationTester {
    constructor(baseURL = null) {
        // 默认使用环境变量或本地地址
        this.baseURL = baseURL || process.env.TEST_BASE_URL || 'http://localhost:3000';
        this.testResults = [];
        this.testData = {
            openid: 'test_user_' + Date.now(),
            game_type: 1002,
            sub_type: 0,
            score: Math.floor(Math.random() * 1000) + 1
        };
        
        console.log(`🔧 测试配置: 基础URL = ${this.baseURL}`);
    }

    // 测试工具方法
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async makeRequest(method, endpoint, data = null, headers = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const startTime = performance.now();
        
        try {
            const config = {
                method,
                url,
                headers: {
                    'Content-Type': 'application/json',
                    'x-wx-source': 'test',
                    'x-wx-openid': this.testData.openid,
                    ...headers
                },
                timeout: 10000
            };

            if (data && (method === 'post' || method === 'put')) {
                config.data = data;
            }

            const response = await axios(config);
            const duration = performance.now() - startTime;

            return {
                success: true,
                status: response.status,
                data: response.data,
                duration,
                error: null
            };
        } catch (error) {
            const duration = performance.now() - startTime;
            
            return {
                success: false,
                status: error.response?.status,
                data: error.response?.data,
                duration,
                error: error.message
            };
        }
    }

    // 测试用例
    async testPerformanceEndpoint() {
        console.log('🧪 测试性能监控接口...');
        const result = await this.makeRequest('get', '/api/performance');
        
        this.testResults.push({
            name: '性能监控接口',
            result: result.success ? '✅ 通过' : '❌ 失败',
            duration: result.duration,
            details: result.data
        });

        return result;
    }

    async testRankListEndpoint() {
        console.log('🧪 测试排行榜接口...');
        const result = await this.makeRequest('get', `/api/all_user_game_data/${this.testData.game_type}/${this.testData.sub_type}`);
        
        this.testResults.push({
            name: '排行榜接口',
            result: result.success ? '✅ 通过' : '❌ 失败',
            duration: result.duration,
            details: `返回数据条数: ${result.data?.data?.length || 0}`
        });

        return result;
    }

    async testSaveGameData() {
        console.log('🧪 测试保存游戏数据...');
        
        const gameData = {
            game_data: {
                game_type: this.testData.game_type,
                sub_type: this.testData.sub_type,
                score: this.testData.score,
                add_play_time: 60,
                record_time: new Date().toISOString()
            },
            user_info: {
                nickName: '测试用户',
                avatarUrl: 'https://example.com/avatar.jpg'
            }
        };

        const result = await this.makeRequest('post', '/api/user_game_data', gameData);
        
        this.testResults.push({
            name: '保存游戏数据',
            result: result.success ? '✅ 通过' : '❌ 失败',
            duration: result.duration,
            details: result.data?.code === 0 ? '保存成功' : '保存失败'
        });

        return result;
    }

    async testGetUserData() {
        console.log('🧪 测试获取用户数据...');
        const result = await this.makeRequest('get', `/api/user_game_data/${this.testData.game_type}/${this.testData.sub_type}`);
        
        this.testResults.push({
            name: '获取用户数据',
            result: result.success ? '✅ 通过' : '❌ 失败',
            duration: result.duration,
            details: `返回数据条数: ${result.data?.data?.length || 0}`
        });

        return result;
    }

    async testClearCache() {
        console.log('🧪 测试清理缓存...');
        const result = await this.makeRequest('post', '/api/clear-cache');
        
        this.testResults.push({
            name: '清理缓存',
            result: result.success ? '✅ 通过' : '❌ 失败',
            duration: result.duration,
            details: result.data?.data || '未知'
        });

        return result;
    }

    async testMemoryUsage() {
        console.log('🧪 测试内存使用情况...');
        
        // 模拟多次请求测试内存稳定性
        const requests = [];
        for (let i = 0; i < 10; i++) {
            requests.push(this.makeRequest('get', `/api/all_user_game_data/${this.testData.game_type}/${this.testData.sub_type}`));
            await this.delay(100); // 间隔100ms
        }

        const results = await Promise.all(requests);
        const successCount = results.filter(r => r.success).length;
        
        this.testResults.push({
            name: '内存压力测试',
            result: successCount === 10 ? '✅ 通过' : '❌ 失败',
            duration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
            details: `成功: ${successCount}/10, 平均响应时间: ${(results.reduce((sum, r) => sum + r.duration, 0) / results.length).toFixed(2)}ms`
        });

        return results;
    }

    async runAllTests() {
        console.log('🚀 开始运行优化测试套件...\n');
        
        try {
            // 测试1: 性能监控
            await this.testPerformanceEndpoint();
            await this.delay(500);

            // 测试2: 排行榜
            await this.testRankListEndpoint();
            await this.delay(500);

            // 测试3: 保存数据
            await this.testSaveGameData();
            await this.delay(1000);

            // 测试4: 获取数据
            await this.testGetUserData();
            await this.delay(500);

            // 测试5: 清理缓存
            await this.testClearCache();
            await this.delay(500);

            // 测试6: 内存压力
            await this.testMemoryUsage();

            // 显示测试结果
            this.displayResults();

        } catch (error) {
            console.error('❌ 测试运行失败:', error.message);
        }
    }

    displayResults() {
        console.log('\n📊 测试结果汇总:');
        console.log('=' .repeat(60));
        
        this.testResults.forEach((test, index) => {
            console.log(`${index + 1}. ${test.name}`);
            console.log(`   结果: ${test.result}`);
            console.log(`   耗时: ${test.duration.toFixed(2)}ms`);
            console.log(`   详情: ${test.details}`);
            console.log('   -' .repeat(15));
        });

        const passed = this.testResults.filter(t => t.result.includes('✅')).length;
        const total = this.testResults.length;
        
        console.log(`\n🎯 测试完成: ${passed}/${total} 通过`);
        console.log('=' .repeat(60));
    }

    // 单独测试某个接口
    async testSpecificEndpoint(endpoint, method = 'get', data = null) {
        console.log(`🧪 测试特定接口: ${method.toUpperCase()} ${endpoint}`);
        
        const result = await this.makeRequest(method, endpoint, data);
        
        console.log('📋 测试结果:');
        console.log(`   状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
        console.log(`   耗时: ${result.duration.toFixed(2)}ms`);
        console.log(`   状态码: ${result.status || 'N/A'}`);
        
        if (result.data) {
            console.log('   响应数据:', JSON.stringify(result.data, null, 2));
        }
        
        if (result.error) {
            console.log('   错误信息:', result.error);
        }

        return result;
    }
}

// 使用示例
async function main() {
    const tester = new OptimizationTester();
    
    // 运行所有测试
    console.log('选择测试模式:');
    console.log('1. 运行完整测试套件');
    console.log('2. 测试特定接口');
    console.log('3. 性能压力测试');
    
    // 这里可以根据需要修改测试模式
    const testMode = 1; // 1: 完整测试, 2: 特定接口, 3: 压力测试
    
    switch (testMode) {
        case 1:
            await tester.runAllTests();
            break;
        case 2:
            // 测试特定接口示例
            await tester.testSpecificEndpoint('/api/performance', 'get');
            break;
        case 3:
            // 压力测试
            await tester.testMemoryUsage();
            break;
        default:
            await tester.runAllTests();
    }
}

// 导出测试类
module.exports = { OptimizationTester };

// 如果直接运行此文件
if (require.main === module) {
    main().catch(console.error);
}