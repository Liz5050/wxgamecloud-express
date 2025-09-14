#!/usr/bin/env node

/**
 * 版本管理脚本
 * 用于管理项目版本号和生成更新日志
 * 使用语义化版本号格式：主版本号.次版本号.修订号
 * 
 * 使用方法：
 * npm run version:major   # 主版本升级 (1.0.0 -> 2.0.0)
 * npm run version:minor   # 次版本升级 (1.0.0 -> 1.1.0) 
 * npm run version:patch   # 修订号升级 (1.0.0 -> 1.0.1)
 * npm run version:log     # 生成更新日志
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 项目根目录
const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'docs', 'CHANGELOG.md');

// 读取当前版本
function getCurrentVersion() {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
}

// 更新版本号
function updateVersion(type) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    let newVersion;
    switch (type) {
        case 'major':
            newVersion = `${major + 1}.0.0`;
            break;
        case 'minor':
            newVersion = `${major}.${minor + 1}.0`;
            break;
        case 'patch':
            newVersion = `${major}.${minor}.${patch + 1}`;
            break;
        default:
            throw new Error('无效的版本类型，请使用 major、minor 或 patch');
    }
    
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log(`✅ 版本号已更新: ${currentVersion} -> ${newVersion}`);
    return newVersion;
}

// 生成更新日志
function generateChangelog(version, versionType) {
    const now = new Date().toISOString().split('T')[0];
    const commitMessage = getLatestCommitMessage();
    
    let changelogContent = '';
    
    // 如果更新日志文件不存在，创建它
    if (!fs.existsSync(changelogPath)) {
        changelogContent = `# 更新日志

本项目遵循 [语义化版本](https://semver.org/) 规范。

## 版本说明
- **主版本号 (Major)**：不兼容的 API 修改
- **次版本号 (Minor)**：向下兼容的功能性新增
- **修订号 (Patch)**：向下兼容的问题修正

## 更新记录

`;
    } else {
        changelogContent = fs.readFileSync(changelogPath, 'utf8');
    }
    
    // 添加新版本记录
    const versionSection = `
## ${version} - ${now}

**版本类型**: ${getVersionTypeChinese(versionType)}
**变更说明**: ${commitMessage || '常规更新和优化'}

### 🚀 新增功能
- 

### 🐛 问题修复
- 

### 📦 优化改进
- 

---
`;
    
    // 将新版本记录插入到更新记录部分之后
    const insertPosition = changelogContent.indexOf('## 更新记录') + '## 更新记录'.length;
    const newChangelog = changelogContent.slice(0, insertPosition) + 
                         versionSection + 
                         changelogContent.slice(insertPosition);
    
    fs.writeFileSync(changelogPath, newChangelog);
    console.log(`✅ 更新日志已生成: docs/CHANGELOG.md`);
}

// 获取最新的提交信息
function getLatestCommitMessage() {
    try {
        return execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
    } catch (error) {
        return null;
    }
}

// 获取版本类型的中文描述
function getVersionTypeChinese(type) {
    const typeMap = {
        'major': '主版本升级',
        'minor': '次版本升级', 
        'patch': '修订版本升级'
    };
    return typeMap[type] || type;
}

// 主函数
function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    try {
        switch (command) {
            case 'major':
            case 'minor':
            case 'patch':
                const newVersion = updateVersion(command);
                generateChangelog(newVersion, command);
                console.log(`\n📋 下一步操作:`);
                console.log(`   1. 编辑 docs/CHANGELOG.md 填写详细的变更内容`);
                console.log(`   2. 提交版本变更: git add package.json docs/CHANGELOG.md`);
                console.log(`   3. 创建版本标签: git tag v${newVersion}`);
                break;
                
            case 'log':
                const currentVersion = getCurrentVersion();
                generateChangelog(currentVersion, 'manual');
                break;
                
            case 'current':
                console.log(`当前版本: ${getCurrentVersion()}`);
                break;
                
            default:
                console.log('版本管理脚本');
                console.log('使用方法:');
                console.log('  npm run version:major   # 主版本升级 (1.0.0 -> 2.0.0)');
                console.log('  npm run version:minor   # 次版本升级 (1.0.0 -> 1.1.0)');
                console.log('  npm run version:patch   # 修订号升级 (1.0.0 -> 1.0.1)');
                console.log('  npm run version:log     # 生成更新日志');
                console.log('  npm run version:current # 查看当前版本');
        }
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    getCurrentVersion,
    updateVersion,
    generateChangelog
};