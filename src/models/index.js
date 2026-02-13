// 加载环境变量 - 使用统一的配置管理系统
const { config: envConfig } = require('../config/env.config.js');

// 设置环境变量（兼容旧代码）
const envVars = envConfig.getCurrentConfig();
Object.assign(process.env, envVars);

const { Sequelize, DataTypes, Op } = require("sequelize");

// 从环境变量中读取数据库配置 - 微信云托管标准配置
const { 
  MYSQL_USERNAME = 'root', 
  MYSQL_PASSWORD = '', 
  MYSQL_ADDRESS = 'localhost:3306',
  MYSQL_DATABASE = 'nodejs_demo'
} = process.env;

// 安全解析地址
let host = 'localhost';
let port = 3306;

if (MYSQL_ADDRESS && MYSQL_ADDRESS.includes(':')) {
  [host, port] = MYSQL_ADDRESS.split(':');
  port = parseInt(port) || 3306;
} else if (MYSQL_ADDRESS) {
  host = MYSQL_ADDRESS;
}

// 创建数据库连接，优化连接池配置以降低MySQL算力成本
// 关键优化：降低最大连接数、缩短空闲时间、更快释放连接
const sequelize = new Sequelize(MYSQL_DATABASE, MYSQL_USERNAME, MYSQL_PASSWORD, {
  host,
  port,
  dialect: "mysql",
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,              // 降低最大连接数（从10降到5），减少资源占用
    min: 0,              // 保持为0，允许连接池完全为空，避免保持最小连接
    acquire: 30000,      // 获取连接超时时间(ms)
    idle: 5000,          // 缩短空闲时间（从10秒降到5秒），更快释放空闲连接
    evict: 1000,         // 驱逐检查间隔(ms)，定期清理无效连接
    handleDisconnects: true, // 自动处理断开连接
    // 连接验证，确保连接有效
    validate: (connection) => {
      return connection && connection._isValid;
    }
  },
  retry: {
    max: 3
  },
  // 添加连接选项，减少连接保持时间
  dialectOptions: {
    connectTimeout: 10000 // 连接超时时间(ms)
    // 注意：reconnect 不是 MySQL2 的有效配置选项
    // Sequelize 已经通过连接池和 retry 配置自动处理重连
  }
});

// 添加连接池监控，帮助诊断连接使用情况
if (process.env.NODE_ENV === 'development') {
  sequelize.connectionManager.pool.on('connection', (connection) => {
    console.log('🔌 数据库连接已建立');
  });

  sequelize.connectionManager.pool.on('release', (connection) => {
    console.log('🔌 数据库连接已释放');
  });
}

// 定期检查并记录连接池状态（生产环境也记录，但频率降低）
const connectionMonitorInterval = setInterval(() => {
  try {
    const pool = sequelize.connectionManager.pool;
    const idleConnections = pool._availableObjects ? pool._availableObjects.length : 0;
    const activeConnections = pool._allObjects ? pool._allObjects.length - idleConnections : 0;
    
    if (idleConnections > 0 || activeConnections > 0) {
      console.log(`📊 数据库连接池状态: 活跃=${activeConnections}, 空闲=${idleConnections}`);
    }
  } catch (error) {
    // 忽略监控错误，不影响主流程
  }
}, process.env.NODE_ENV === 'development' ? 30000 : 300000); // 开发环境30秒，生产环境5分钟

// 优雅关闭：进程退出时清理连接池监控
process.on('SIGTERM', () => {
  clearInterval(connectionMonitorInterval);
});

process.on('SIGINT', () => {
  clearInterval(connectionMonitorInterval);
});

// // 数据库初始化方法
// async function init() {
//   await Counter.sync({ alter: true })
// }

const user_game_data = sequelize.define("user_game_data", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  openid: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  game_type: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  sub_type: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  appid: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  score: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  play_time: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  nick_name: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  avatar_url: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  record_time: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
});

async function initUser_game_data() {
  await user_game_data.sync();
}

const user_data = sequelize.define("user_data", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  openid: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  nick_name: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  avatar_url: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  score: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  skin_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  skin_list: {
    type: DataTypes.STRING,
    defaultValue:""
  }
});

async function initUser_data() {
  await user_data.sync();
}

const share_rewards = sequelize.define("share_rewards", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  openid: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  share_time: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  share_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  }
})

async function initShare_rewards() {
  await share_rewards.sync();
}

// GameGridSaveDB模型定义
const game_grid_save_data = sequelize.define("game_grid_save_data", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  openid: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  data_str: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  is_valid: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  }
});

async function initGameGridSave() {
  await game_grid_save_data.sync();
}

// 导出初始化方法和模型
module.exports = {
  // init,
  // Counter,
  initUser_game_data,
  user_game_data,
  initUser_data,
  user_data,
  initShare_rewards,
  share_rewards,
  initGameGridSave,
  game_grid_save_data,
  sequelize,
  Op
};
