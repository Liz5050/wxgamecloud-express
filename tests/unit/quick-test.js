#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🚀 快速测试脚本 - 微信云托管优化测试');
console.log('=' .repeat(50));

// 检查依赖
function checkDependencies() {
    try {
        require('axios');
        console.log('✅ axios 依赖已安装');
        return true;
    } catch (error) {
        console.log('❌ axios 依赖未安装');
        console.log('请运行: npm install axios --save-dev');
        return false;
    }
}

// 检查服务器状态
function checkServerStatus() {
    try {
        const result = execSync('netstat -ano | findstr :80', { encoding: 'utf8' });
        if (result.includes('LISTENING')) {
            console.log('✅ 端口80已被占用（服务器可能正在运行）');
            return true;
        }
    } catch (error) {
        // netstat 命令可能失败
    }
    
    console.log('⚠️  服务器未运行在端口80');
    return false;
}

// 运行单个测试
function runBasicTest() {
    console.log('\n🧪 运行基础API测试...');
    
    try {
        const { OptimizationTester } = require('../integration/testOptimization');
        const tester = new OptimizationTester();
        
        // 只运行关键测试
        tester.testPerformanceEndpoint()
            .then(() => tester.testRankListEndpoint())
            .then(() => {
                console.log('\n✅ 基础测试完成');
                console.log('📊 检查测试结果是否正常');
                rl.question('↵ 按回车键继续...', () => {
                    rl.close();
                });
            })
            .catch(error => {
                console.error('❌ 测试失败:', error.message);
                rl.close();
            });
            
    } catch (error) {
        console.error('❌ 无法运行测试:', error.message);
        rl.close();
    }
}

// 主函数
function main() {
    if (!checkDependencies()) {
        rl.close();
        return;
    }
    
    if (!checkServerStatus()) {
        console.log('\n💡 请先启动服务器:');
        console.log('   1. 新开一个终端');
        console.log('   2. 运行: npm start');
        console.log('   3. 等待服务器启动完成');
        console.log('   4. 然后再次运行此测试');
        rl.close();
        return;
    }
    
    console.log('\n📋 测试选项:');
    console.log('1. 运行快速测试');
    console.log('2. 启动服务器并测试');
    console.log('3. 退出');
    
    rl.question('请选择 (1-3): ', (choice) => {
        switch (choice) {
            case '1':
                runBasicTest();
                break;
            case '2':
                startServerAndTest();
                break;
            case '3':
                console.log('👋 再见！');
                rl.close();
                break;
            default:
                console.log('❌ 无效选择');
                rl.close();
        }
    });
}

// 启动服务器并测试
function startServerAndTest() {
    console.log('🚀 启动服务器...');
    
    const serverProcess = spawn('node', ['index.js'], {
        stdio: 'pipe',
        env: process.env
    });
    
    serverProcess.stdout.on('data', (data) => {
        console.log(`服务器: ${data.toString().trim()}`);
        
        // 检测服务器启动完成
        if (data.toString().includes('启动成功')) {
            console.log('✅ 服务器启动成功，开始测试...');
            
            // 等待2秒让服务器完全启动
            setTimeout(() => {
                runBasicTest();
            }, 2000);
        }
    });
    
    serverProcess.stderr.on('data', (data) => {
        console.error(`服务器错误: ${data.toString().trim()}`);
    });
    
    serverProcess.on('close', (code) => {
        console.log(`服务器进程退出，代码: ${code}`);
    });
}

// 启动程序
main();

// 优雅退出
rl.on('close', () => {
    console.log('\n测试程序已关闭');
    process.exit(0);
});