const http = require('http');

// 测试缓存清理功能
async function testCacheCleanup() {
    console.log('=== 测试缓存清理功能 ===\n');
    
    // 1. 模拟多次请求排行榜数据，填充缓存
    console.log('1. 模拟请求排行榜数据...');
    
    const gameTypes = [1001, 1002, 1003];
    const subTypes = [0, 100, 101];
    
    for (let gameType of gameTypes) {
        for (let subType of subTypes) {
            await fetchRankList(gameType, subType);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    console.log('\n2. 等待2秒让缓存稳定...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. 手动触发缓存清理
    console.log('\n3. 触发手动缓存清理...');
    await triggerCacheCleanup();
    
    console.log('\n4. 等待5秒...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 3. 检查性能监控数据
    console.log('\n5. 获取性能监控数据...');
    await getPerformanceData();
    
    console.log('\n=== 测试完成 ===');
}

// 模拟获取排行榜数据
function fetchRankList(gameType, subType) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: process.env.PORT || 3000,
            path: `/api/get_rank_data?game_type=${gameType}&sub_type=${subType}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { resolve(data); });
        });
        
        req.on('error', (error) => {
            console.error(`获取排行榜失败 (${gameType}_${subType}):`, error.message);
            resolve(null);
        });
        
        req.end();
    });
}

// 触发缓存清理
function triggerCacheCleanup() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: process.env.PORT || 3000,
            path: '/api/clear-cache',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log(`手动清理结果: ${result.data}`);
                    resolve(result);
                } catch (e) {
                    resolve(data);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('手动清理失败:', error.message);
            reject(error);
        });
        
        req.end();
    });
}

// 获取性能监控数据
function getPerformanceData() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: process.env.PORT || 3000,
            path: '/api/performance',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log(`当前内存使用率: ${result.data.memory.current}`);
                    console.log(`平均响应时间: ${result.data.responseTimes.averageResponseTime}`);
                    resolve(result);
                } catch (e) {
                    resolve(data);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('获取性能数据失败:', error.message);
            reject(error);
        });
        
        req.end();
    });
}

// 运行测试
testCacheCleanup().catch(error => {
    console.error('测试过程中发生错误:', error);
    process.exit(1);
});
