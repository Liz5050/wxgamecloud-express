# 端口切换指南

## 快速切换端口的方法

现在您可以通过以下几种方式轻松切换服务器端口：

### 方法1：使用预设命令（推荐）

```bash
# 使用3000端口（本地开发默认）
npm run dev:3000

# 使用80端口（生产环境默认）
npm run dev:80

# 使用.env.local配置中的端口设置
npm run dev
```

### 方法2：自定义端口

```bash
# 临时设置任意端口
set PORT=8080&& npm start

# 或者使用自定义环境文件
set PORT=8080&& node -r dotenv/config index.js dotenv_config_path=.env.custom
```

### 方法3：修改环境配置文件

编辑 `.env.local` 文件中的 `PORT` 变量：

```env
# 本地开发环境配置
PORT=3000  # 修改这里的数字即可切换端口

# 其他配置...
MYSQL_USERNAME=root
MYSQL_PASSWORD=
```

## 环境配置文件说明

- **`.env.local`** - 本地开发环境配置（已设置为3000端口）
- **默认配置** - 如果没有指定环境文件，默认使用80端口

## 常用命令

| 命令 | 说明 | 端口 |
|------|------|------|
| `npm run dev` | 使用.env.local配置 | 3000 |
| `npm run dev:3000` | 强制使用3000端口 | 3000 |
| `npm run dev:80` | 强制使用80端口 | 80 |
| `npm run dev:custom` | 使用当前环境变量 | 可变 |
| `npm start` | 生产模式启动 | 80 |

## 端口冲突解决方案

如果遇到端口被占用的情况：

1. **查找占用端口的进程**：
   ```bash
   netstat -ano | findstr :3000
   ```

2. **终止占用进程**：
   ```bash
   taskkill /pid <PID> /f
   ```

3. **或者直接切换其他端口**：
   ```bash
   set PORT=3001&& npm start
   ```

## 注意事项

- 本地开发建议使用3000端口，避免权限问题
- 生产环境使用80端口（需要管理员权限）
- 修改 `.env.local` 后无需重启，下次运行自动生效