#!/usr/bin/env node

/**
 * 应用入口文件
 * 启动 Express 服务器
 */

const app = require('./src/app');

const port = process.env.PORT || 80;

app.listen(port, () => {
    console.log("🚀 服务器启动成功，端口:", port);
    console.log("📦 当前版本:", require('./package.json').version);
});