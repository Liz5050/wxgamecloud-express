const { Sequelize, DataTypes } = require("sequelize");

// 从环境变量中读取数据库配置
const { MYSQL_USERNAME, MYSQL_PASSWORD, MYSQL_ADDRESS = "" } = process.env;

const [host, port] = MYSQL_ADDRESS.split(":");

const sequelize = new Sequelize("nodejs_demo", MYSQL_USERNAME, MYSQL_PASSWORD, {
  host,
  port,
  dialect: "mysql" /* one of 'mysql' | 'mariadb' | 'postgres' | 'mssql' */,
});

// 定义数据模型
const Counter = sequelize.define("Counter", {
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
});

// 数据库初始化方法
async function init() {
  await Counter.sync({ alter: true });
}

const user_game_data = sequelize.define("user_game_data", {
  openid: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "",
  },
  game_type: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  appid: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "",
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  nick_name: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "",
  },
  avatar_url: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "",
  },
});

async function initUser_game_data() {
  await Counter.sync({ alter: true });
}

// 导出初始化方法和模型
module.exports = {
  init,
  Counter,
  initUser_game_data,
  user_game_data,
};
