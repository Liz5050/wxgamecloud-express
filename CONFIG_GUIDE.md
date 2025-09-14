# 环境配置指南

## 📁 配置文件结构

现在您的项目有以下配置文件：

| 文件 | 用途 | 优先级 |
|------|------|--------|
| `.env` | 主配置文件（默认值） | 最低 |
| `.env.local` | 本地开发配置 | 中 |
| `.env.test` | 测试环境配置 | 高（当NODE_ENV=test时） |
| `.env.production` | 生产环境配置 | 高（当NODE_ENV=production时） |

## 🚀 快速使用

### 1. 本地开发（3000端口）
```bash
# 使用.env.local配置（已设置为3000端口）
npm run dev

# 或者明确指定端口
npm run dev:3000
```

### 2. 测试环境（80端口）
```bash
# 设置测试环境并启动
set NODE_ENV=test&& npm start

# 或者使用测试配置
npm run dev:80
```

### 3. 生产环境
```bash
# 设置生产环境
set NODE_ENV=production&& npm start
```

## 🔧 配置优先级

新的配置系统按以下优先级加载配置：

1. **系统环境变量**（最高优先级）
2. **特定环境配置**（.env.test 或 .env.production）
3. **本地开发配置**（.env.local）
4. **默认配置**（.env）

## 📋 配置示例

### `.env`（默认配置）
```env
PORT=80
MYSQL_USERNAME=root
MYSQL_PASSWORD=
MYSQL_ADDRESS=localhost:3306
NODE_ENV=development
```

### `.env.local`（本地开发）
```env
PORT=3000
MYSQL_PASSWORD=local_password
```

### `.env.test`（测试环境）
```env
PORT=80
MYSQL_PASSWORD=zZ36542788
MYSQL_ADDRESS=sh-cynosdbmysql-grp-79r4hq0g.sql.tencentcdb.com:24301
NODE_ENV=test
TEST_BASE_URL=http://10.10.108.9:80
```

## 🛠️ 配置管理工具

项目现在包含一个统一的配置管理系统：

### 使用示例
```javascript
const { get, printConfig } = require('./config/env.config');

// 获取配置值
const port = get('PORT', 3000);
const dbHost = get('MYSQL_ADDRESS');

// 打印当前配置（隐藏敏感信息）
printConfig();
```

### 主要方法
- `get(key, defaultValue)` - 获取配置值
- `printConfig()` - 打印当前配置
- `getCurrentConfig()` - 获取完整配置对象

## 🔒 安全注意事项

1. **敏感信息**：密码、令牌等敏感信息不要提交到版本控制
2. **gitignore**：`.env.local` 和 `.env` 已在.gitignore中排除
3. **环境变量**：生产环境建议使用系统环境变量

## 🐛 故障排除

### 端口冲突
```bash
# 查找占用端口的进程
netstat -ano | findstr :3000

# 终止进程
taskkill /pid <PID> /f

# 或者切换端口
set PORT=3001&& npm start
```

### 配置不生效
1. 检查 `NODE_ENV` 环境变量设置
2. 确认配置文件语法正确（每行 KEY=VALUE）
3. 重启服务使配置生效

## 📝 最佳实践

1. **开发环境**：使用 `.env.local` 进行个人配置
2. **测试环境**：使用 `.env.test` 配置测试数据库
3. **生产环境**：使用系统环境变量或 `.env.production`
4. **默认值**：在 `.env` 中设置所有可能的配置项

这样您就可以轻松地在不同环境间切换，而无需修改代码！