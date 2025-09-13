#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// 创建交互式命令行界面
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🚀 云服务器优化测试启动器');
console.log('=' .repeat(50));

// 检查必要文件
function checkRequiredFiles() {
    const requiredFiles = [
        'index.js',
        'db.js', 
        'performanceMonitor.js',
        'testOptimization.js',
        'test.config.js'
    ];

    const missingFiles = [];
    requiredFiles.forEach(file => {
        if (!fs.existsSync(file)) {
            missingFiles.push(file);
        }
    });

    if (missingFiles.length > 0) {
        console.log('❌ 缺少必要文件:', missingFiles.join(', '));
        console.log('请确保所有优化文件已正确创建');
        process.exit(1);
    }

    console.log('✅ 所有必要文件检查通过');
}

// 显示测试菜单
function showMenu() {
    console.log('\n📋 请选择测试模式:');
    console.log('1. 🟢 安全模式 - 基础功能测试（推荐）');
    console.log('2. 🟡 标准模式 - 包含性能测试');
    console.log('3. 🔴 压力模式 - 完整压力测试（谨慎！）');
    console.log('4. 🛠️  自定义测试');
    console.log('5. 📊 仅监控性能');
    console.log('6. ❌ 退出');
    console.log('');
}

// 运行测试
function runTest(mode) {
    console.log(`\n🎯 开始运行 ${mode} 测试...\n`);
    
    try {
        const { OptimizationTester } = require('./testOptimization');
        const tester = new OptimizationTester();
        
        switch (mode) {
            case '安全模式':
                // 只运行基础测试
                tester.runAllTests();
                break;
                
            case '标准模式':
                // 基础测试 + 性能测试
                tester.runAllTests();
                console.log('\n🔧 运行额外性能测试...');
                tester.testMemoryUsage();
                break;
                
            case '压力模式':
                console.log('🚨 警告：压力测试可能会影响生产环境！');
                rl.question('确认继续？(y/N): ', (answer) => {
                    if (answer.toLowerCase() === 'y') {
                        tester.runAllTests();
                        // 运行多次压力测试
                        for (let i = 0; i < 3; i++) {
                            console.log(`\n⚡ 压力测试第 ${i + 1} 轮...`);
                            tester.testMemoryUsage();
                        }
                    } else {
                        console.log('已取消压力测试');
                        showMenu();
                    }
                });
                return;
                
            case '自定义测试':
                runCustomTest();
                return;
                
            case '仅监控性能':
                runPerformanceMonitor();
                return;
        }
        
        // 测试完成后返回菜单
        setTimeout(() => {
            rl.question('\n↵ 按回车键返回菜单...', () => {
                showMenu();
                askForChoice();
            });
        }, 1000);
        
    } catch (error) {
        console.error('❌ 测试运行失败:', error.message);
        rl.question('↵ 按回车键返回菜单...', () => {
            showMenu();
            askForChoice();
        });
    }
}

// 运行自定义测试
function runCustomTest() {
    console.log('\n🔧 自定义测试选项:');
    console.log('1. 测试性能监控接口');
    console.log('2. 测试排行榜接口');
    console.log('3. 测试保存数据接口');
    console.log('4. 测试清理缓存');
    console.log('5. 返回主菜单');
    
    rl.question('请选择 (1-5): ', (choice) => {
        const { OptimizationTester } = require('./testOptimization');
        const tester = new OptimizationTester();
        
        switch (choice) {
            case '1':
                tester.testPerformanceEndpoint().then(() => backToCustomMenu());
                break;
            case '2':
                tester.testRankListEndpoint().then(() => backToCustomMenu());
                break;
            case '3':
                tester.testSaveGameData().then(() => backToCustomMenu());
                break;
            case '4':
                tester.testClearCache().then(() => backToCustomMenu());
                break;
            case '5':
                showMenu();
                askForChoice();
                break;
            default:
                console.log('无效选择');
                runCustomTest();
        }
    });
}

function backToCustomMenu() {
    rl.question('↵ 按回车键返回自定义菜单...', () => {
        runCustomTest();
    });
}

// 运行性能监控
function runPerformanceMonitor() {
    console.log('📊 启动性能监控...（Ctrl+C 退出）');
    
    try {
        const { PerformanceMonitor } = require('./performanceMonitor');
        const monitor = new PerformanceMonitor();
        
        const interval = setInterval(() => {
            const stats = monitor.getPerformanceStats();
            console.clear();
            console.log('📊 实时性能监控');
            console.log('=' .repeat(30));
            console.log(`内存使用: ${stats.memoryUsage}MB`);
            console.log(`CPU使用率: ${stats.cpuUsage}%`);
            console.log(`运行时间: ${stats.uptime}秒`);
            console.log(`请求总数: ${stats.totalRequests}`);
            console.log(`平均响应时间: ${stats.avgResponseTime}ms`);
            console.log('=' .repeat(30));
            console.log('按 Ctrl+C 退出监控');
        }, 2000);
        
        // 处理退出
        process.on('SIGINT', () => {
            clearInterval(interval);
            console.log('\n监控已停止');
            showMenu();
            askForChoice();
        });
        
    } catch (error) {
        console.error('❌ 启动监控失败:', error.message);
        showMenu();
        askForChoice();
    }
}

// 询问用户选择
function askForChoice() {
    rl.question('请选择测试模式 (1-6): ', (choice) => {
        switch (choice) {
            case '1':
                runTest('安全模式');
                break;
            case '2':
                runTest('标准模式');
                break;
            case '3':
                runTest('压力模式');
                break;
            case '4':
                runCustomTest();
                break;
            case '5':
                runPerformanceMonitor();
                break;
            case '6':
                console.log('👋 再见！');
                rl.close();
                break;
            default:
                console.log('❌ 无效选择，请重新输入');
                askForChoice();
        }
    });
}

// 检查服务器是否运行
async function checkServerRunning() {
    try {
        const axios = require('axios');
        const response = await axios.get('http://localhost:80/api/performance', {
            timeout: 2000
        });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// 主函数
async function main() {
    console.log('🔍 检查测试环境...');
    checkRequiredFiles();
    
    console.log('✅ 环境检查完成');
    
    // 检查服务器是否运行
    const isServerRunning = await checkServerRunning();
    if (!isServerRunning) {
        console.log('⚠️  服务器未运行！请先启动服务器：');
        console.log('   npm start');
        console.log('   或者');
        console.log('   node index.js');
        console.log('');
        console.log('📖 详细测试指南请查看 TEST_README.md');
        rl.question('↵ 按回车键退出...', () => {
            rl.close();
        });
        return;
    }
    
    console.log('✅ 服务器运行正常');
    console.log('📖 详细测试指南请查看 TEST_README.md');
    
    showMenu();
    askForChoice();
}

// 启动程序
main();

// 优雅退出
rl.on('close', () => {
    console.log('\n测试程序已关闭');
    process.exit(0);
});