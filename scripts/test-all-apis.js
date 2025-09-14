#!/usr/bin/env node

/**
 * 全面API测试脚本
 * 测试重构后的项目所有API接口功能
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_OPENID = 'test_user_' + Date.now();

async function testAPI(endpoint, method = 'get', data = null) {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'x-wx-source': 'test',
                'x-wx-openid': TEST_OPENID
            },
            timeout: 5000
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return {
            success: true,
            status: response.status,
            data: response.data,
            message: '✅ 测试通过'
        };
    } catch (error) {
        return {
            success: false,
            status: error.response?.status,
            data: error.response?.data,
            message: `❌ 测试失败: ${error.message}`
        };
    }
}

async function runAllTests() {
    console.log('🚀 开始全面API测试\n');
    
    const testResults = [];

    // 1. 测试性能监控接口
    console.log('1. 测试性能监控接口...');
    const perfResult = await testAPI('/api/performance');
    testResults.push({ name: '性能监控接口', ...perfResult });
    console.log(perfResult.message);

    // 2. 测试排行榜接口
    console.log('\n2. 测试排行榜接口...');
    const rankResult = await testAPI('/api/all_user_game_data/1002/0');
    testResults.push({ name: '排行榜接口', ...rankResult });
    console.log(rankResult.message);

    // 3. 测试保存游戏数据
    console.log('\n3. 测试保存游戏数据...');
    const saveData = {
        game_data: {
            game_type: 1002,
            sub_type: 0,
            score: Math.floor(Math.random() * 1000) + 1,
            add_play_time: 60,
            record_time: new Date().toISOString()
        },
        user_info: {
            nickName: '测试用户',
            avatarUrl: 'https://example.com/avatar.jpg'
        }
    };
    const saveResult = await testAPI('/api/user_game_data', 'post', saveData);
    testResults.push({ name: '保存游戏数据', ...saveResult });
    console.log(saveResult.message);

    // 4. 测试获取用户数据
    console.log('\n4. 测试获取用户数据...');
    const userResult = await testAPI('/api/user_data');
    testResults.push({ name: '获取用户数据', ...userResult });
    console.log(userResult.message);

    // 5. 测试清理缓存
    console.log('\n5. 测试清理缓存...');
    const cacheResult = await testAPI('/api/clear-cache', 'post');
    testResults.push({ name: '清理缓存', ...cacheResult });
    console.log(cacheResult.message);

    // 6. 测试游戏进度保存
    console.log('\n6. 测试游戏进度保存...');
    const progressData = { jsonStr: JSON.stringify({ level: 5, score: 1000 }) };
    const progressResult = await testAPI('/api/game_grid_save', 'post', progressData);
    testResults.push({ name: '游戏进度保存', ...progressResult });
    console.log(progressResult.message);

    // 7. 测试数据库清理状态
    console.log('\n7. 测试数据库清理状态...');
    const cleanupResult = await testAPI('/api/db_cleanup_status');
    testResults.push({ name: '数据库清理状态', ...cleanupResult });
    console.log(cleanupResult.message);

    // 输出测试结果汇总
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(50));
    
    let passed = 0;
    let failed = 0;
    
    testResults.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${result.name}`);
        if (result.success) passed++;
        else failed++;
    });

    console.log('\n' + '='.repeat(50));
    console.log(`总计: ${testResults.length} 个测试`);
    console.log(`通过: ${passed} | 失败: ${failed}`);
    
    if (failed === 0) {
        console.log('🎉 所有API测试通过！项目重构成功！');
    } else {
        console.log('⚠️  部分测试失败，请检查相关接口');
    }
    
    console.log('\n📋 下一步操作:');
    console.log('   1. 检查失败的具体原因');
    console.log('   2. 运行 npm run version:patch 更新版本号');
    console.log('   3. 提交代码到版本控制');
    console.log('   4. 推送到master分支');
}

// 检查服务器是否运行
async function checkServer() {
    try {
        await axios.get(`${BASE_URL}/api/performance`, { timeout: 2000 });
        return true;
    } catch (error) {
        console.log('❌ 服务器未运行！请先启动服务器：');
        console.log('   npm run dev');
        return false;
    }
}

async function main() {
    console.log('🔍 检查服务器状态...');
    const isRunning = await checkServer();
    
    if (isRunning) {
        await runAllTests();
    } else {
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { runAllTests };