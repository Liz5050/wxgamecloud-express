# 生产环境优化测试指南

## 🚨 重要安全警告

**这是生产环境分支！请务必谨慎操作！**

## 📋 测试准备

### 1. 环境检查
```bash
# 确认当前环境
node -v
npm ls

# 检查当前内存使用情况
npm install -g node-memory-monitor
memory-monitor
```

### 2. 数据备份（强烈建议）
```bash
# 备份数据库（根据实际数据库配置）
mysqldump -u username -p database_name > backup_$(date +%Y%m%d_%H%M%S).sql

# 备份代码
cp -r g:/Work/cocoscreator/svn/cloud/wxgamecloud-express g:/Work/cocoscreator/svn/cloud/wxgamecloud-express_backup_$(date +%Y%m%d_%H%M%S)
```

## 🧪 测试步骤

### 步骤1：启动测试服务器
```bash
# 使用生产模式启动（确保配置正确）
set NODE_ENV=production
node index.js

# 或者使用PM2（如果已安装）
npm install -g pm2
pm2 start index.js --name "cloud-server-test" --env production
```

### 步骤2：运行基础功能测试
```bash
# 运行基础测试（安全模式）
node testOptimization.js

# 或者使用配置文件的测试
node -e "
const { OptimizationTester } = require('./testOptimization');
const config = require('./test.config');
const tester = new OptimizationTester(config.testEnvironment.baseURL);
tester.runAllTests();
"
```

### 步骤3：手动接口测试

#### 测试性能监控接口
```bash
curl -X GET "http://localhost:80/api/performance"
```

#### 测试排行榜接口
```bash
curl -X GET "http://localhost:80/api/all_user_game_data/1002/0"
```

#### 测试清理缓存
```bash
curl -X POST "http://localhost:80/api/clear-cache"
```

### 步骤4：监控系统状态

```javascript
// 实时监控内存使用
const monitor = require('./performanceMonitor');
setInterval(() => {
    const stats = monitor.getPerformanceStats();
    console.log(`内存使用: ${stats.memoryUsage}MB, CPU: ${stats.cpuUsage}%`);
}, 5000);
```

## 🔧 测试场景

### 场景1：基础功能验证
1. 启动服务器
2. 运行 `node testOptimization.js`
3. 检查所有测试是否通过
4. 验证响应时间是否在合理范围内

### 场景2：内存泄漏测试
1. 运行压力测试（谨慎！）
2. 监控内存使用情况
3. 检查是否有内存持续增长

### 场景3：并发性能测试
```bash
# 使用ab进行并发测试（安装apache bench）
ab -n 100 -c 10 "http://localhost:80/api/all_user_game_data/1002/0"
```

## 📊 预期结果

### 正常指标
- 内存使用：< 100MB（优化前可能 > 500MB）
- 平均响应时间：< 300ms
- 错误率：< 1%
- CPU使用率：< 50%

### 警告指标
- 内存持续增长 > 10MB/分钟
- 响应时间 > 1000ms
- 错误率 > 5%
- CPU使用率 > 80%

## 🚨 紧急恢复

如果测试发现问题，立即执行：

```bash
# 停止测试服务器
pm2 stop cloud-server-test
# 或者直接 kill 进程

# 恢复备份
cp -r g:/Work/cocoscreator/svn/cloud/wxgamecloud-express_backup_* g:/Work/cocoscreator/svn/cloud/wxgamecloud-express

# 重启原始服务
cd g:/Work/cocoscreator/svn/cloud/wxgamecloud-express_backup_*
npm start
```

## 📝 测试记录模板

```
测试时间: ______________
测试人员: ______________
服务器状态: □ 正常 □ 警告 □ 异常
内存使用: ______ MB (优化前: ______ MB)
响应时间: ______ ms (优化前: ______ ms)
错误数量: ______
测试结果: □ 通过 □ 部分通过 □ 失败
问题记录: 
____________________________________
____________________________________
```

## 🔍 常见问题排查

1. **内存不降反升**
   - 检查缓存清理机制
   - 验证数据库查询优化

2. **响应时间变长**
   - 检查数据库索引
   - 验证缓存命中率

3. **接口报错**
   - 检查 Sequelize 配置
   - 验证数据模型兼容性

## 📞 支持联系

如遇紧急问题，请联系：
- 系统管理员：________
- 开发负责人：________
- 紧急电话：________

---

**切记：生产环境测试务必谨慎，做好完整备份！**