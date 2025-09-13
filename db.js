// 加载环境变量
require('dotenv').config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

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

// 创建数据库连接，添加连接池配置优化性能
const sequelize = new Sequelize(MYSQL_DATABASE, MYSQL_USERNAME, MYSQL_PASSWORD, {
  host,
  port,
  dialect: "mysql",
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  retry: {
    max: 3
  }
});

// // 数据库初始化方法
// async function init() {
//   await Counter.sync({ alter: true })
// }

const user_game_data = sequelize.define("user_game_data", {
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
  sequelize,
  Op
};
