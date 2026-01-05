#!/usr/bin/env node

/**
 * 应用入口文件
 * 启动 Express 服务器
 */

// 导入bootstrap函数，确保数据库清理等初始化逻辑被执行
const { app } = require('./src/app');
const bootstrap = require('./src/app').bootstrap;

const port = process.env.PORT || 3000;

// 先执行bootstrap初始化，再启动服务器
async function startServer() {
    try {
        // 执行初始化逻辑（包括数据库清理系统）
        await bootstrap();
        
        // 启动Express服务器
        app.listen(port, () => {
            console.log("🚀 服务器启动成功，端口:", port);
            console.log("📦 当前版本:", require('./package.json').version);
        });
    } catch (error) {
        console.error("❌ 服务器启动失败:", error);
        process.exit(1);
    }
}

// 执行启动流程
startServer();