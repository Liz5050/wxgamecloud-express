const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB, Counter, initUser_game_data:initUserDB, user_game_data } = require("./db");
const { Op } = require("sequelize");

const logger = morgan("tiny");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

// 首页
app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 更新计数
app.post("/api/count", async (req, res) => {
  const { action } = req.body;
  if (action === "inc") {
    await Counter.create();
  } else if (action === "clear") {
    await Counter.destroy({
      truncate: true,
    });
  }
  res.send({
    code: 0,
    data: await Counter.count(),
  });
});

// 获取计数
app.get("/api/count", async (req, res) => {
  const result = await Counter.count();
  res.send({
    code: 0,
    data: result,
  });
});

// 小程序调用，获取微信 Open ID
app.get("/api/wx_openid", async (req, res) => {
  if (req.headers["x-wx-source"]) {
    res.send(req.headers["x-wx-openid"]);
  }
});

app.get("/api/user_game_data",async (req,res) =>{
  console.log("获取用户游戏数据",req,res);
  const {game_type} = req.body;
  const openid = req.headers["x-wx-openid"];
  const item = await user_game_data.findAll({
    where:{
      openid:openid,
      game_type:game_type,
    }
  });
  if (item && item.length > 0) {
    res.send({code:0,data:item});
  } else {
    res.send({code:-1,data:"查询失败"});
  }
});

app.post("/api/user_game_data",async (req,res) =>{
  const { game_data,user_info } = req.body;
  console.log("保存用户游戏数据",game_data,user_info);
  if (req.headers["x-wx-source"]) {
    const openid = req.headers["x-wx-openid"];
    const item = await user_game_data.findAll({
      where:{
        openid:openid,
        game_type:game_data.game_type
      }
    })
    if(item && item.length > 0){
      if(item[0].score < game_data.score){
        item[0].set({
          score:game_data.score,
        });
        await item[0].save();
        res.send({code:1,data:item});
      }
      else{
        res.send({code:1,data:"未刷新记录"});
      }
    }
    else {
      const ugameData = await user_game_data.create({
        openid:openid,
        game_type:game_data.game_type,
        score:game_data.score,
        nick_name:user_info.nickName,
        avatar_url:user_info.avatarUrl
      });
      res.send({code:0,data:ugameData});
    }
  }
});

const port = process.env.PORT || 80;

async function bootstrap() {
  await initDB();
  await initUserDB();
  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();
