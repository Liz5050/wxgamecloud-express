const { Sequelize, DataTypes } = require("sequelize");

// 从环境变量中读取数据库配置
const { MYSQL_USERNAME, MYSQL_PASSWORD, MYSQL_ADDRESS = "" } = process.env;

const [host, port] = MYSQL_ADDRESS.split(":");

const sequelize = new Sequelize("nodejs_demo", MYSQL_USERNAME, MYSQL_PASSWORD, {
  host,
  port,
  dialect: "mysql" /* one of 'mysql' | 'mariadb' | 'postgres' | 'mssql' */,
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
  nick_name_buffer:{
    type:DataTypes.BLOB,
    defaultValue:null
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
  sequelize
};
