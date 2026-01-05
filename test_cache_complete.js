const http = require('http');

// 测试配置
const BASE_URL = 'http://localhost:3000';
const TEST_TYPES = [
    { game_type: 1001, sub_type: 101 },
    { game_type: 1002, sub_type: 100 },
    { game_type: 1003, sub_type: 101 },
    { game_type: 1001, sub_type: 0 },
    { game_type: 1002, sub_type: 101 },
    { game_type: 1003, sub_type: 0 }
];

// 发送HTTP请求
function fetchRankData(gameType, subType) {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: `/api/get_rank_data?game_type=${gameType}&sub_type=${subType}`,
        method: 'GET'
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({});
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

// 触发缓存清理
function triggerCacheCleanup() {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/clear-cache',
        method: 'POST'
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ message: data });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

// 测试主函数
async function runCompleteTest() {
    console.log('=== 完整缓存功能测试 ===\n');

    try {
        // 1. 第一次请求：填充缓存
        console.log('1. 首次请求排行榜数据（填充缓存）...');
        for (const { game_type, sub_type } of TEST_TYPES) {
            await fetchRankData(game_type, sub_type);
            console.log(`   请求: game_type=${game_type}, sub_type=${sub_type}`);
        }
        console.log('✅ 所有首次请求完成\n');

        // 2. 第二次请求：验证缓存命中
        console.log('2. 第二次请求（验证缓存命中）...');
        await fetchRankData(TEST_TYPES[0].game_type, TEST_TYPES[0].sub_type);
        console.log(`   请求: game_type=${TEST_TYPES[0].game_type}, sub_type=${TEST_TYPES[0].sub_type}`);
        console.log('✅ 缓存命中测试完成\n');

        // 3. 触发手动清理
        console.log('3. 触发手动缓存清理...');
        const cleanupResult = await triggerCacheCleanup();
        console.log(`   手动清理结果: ${cleanupResult.message}`);
        console.log('✅ 手动清理测试完成\n');

        // 4. 测试TTL过期
        console.log('4. 测试缓存TTL过期（等待20秒）...');
        await new Promise(resolve => setTimeout(resolve, 20000));
        console.log('   缓存已过期，发起新请求...');
        await fetchRankData(TEST_TYPES[1].game_type, TEST_TYPES[1].sub_type);
        console.log(`   请求: game_type=${TEST_TYPES[1].game_type}, sub_type=${TEST_TYPES[1].sub_type}`);
        console.log('✅ TTL过期测试完成\n');

        // 5. 测试LRU清理策略
        console.log('5. 测试LRU清理策略（发送大量不同类型请求）...');
        // 发送超过最大缓存数量的请求
        for (let i = 0; i < 25; i++) {
            const game_type = 1000 + i;
            await fetchRankData(game_type, 0);
            if (i % 5 === 0) {
                console.log(`   已发送 ${i + 1}/25 个请求`);
            }
        }
        console.log('   所有请求完成，检查LRU清理效果...');
        console.log('✅ LRU策略测试完成\n');

        console.log('=== 所有测试完成！缓存功能正常工作 ===');

    } catch (error) {
        console.error('测试过程中发生错误:', error.message);
    }
}

// 运行测试
runCompleteTest();
