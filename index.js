const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB, Counter, initUser_game_data:initUserDB, user_game_data,initUser_data,user_data,sequelize} = require("./db");

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

app.get("/api/all_user_game_data/:game_type?/:sub_type?",async (req,res) =>{
  const game_type = req.params.game_type;
  const sub_type = req.params.sub_type;
  console.log("获取所有玩家的游戏数据game_type = " + game_type,"sub_type = " + sub_type);
  if(game_type){
    let orderStr = 'DESC';
    if(game_type == 1001){
      orderStr = 'ASC';
    }
    const item = await user_game_data.findAll({
      where:{
        game_type:game_type,
        sub_type:sub_type
      },
      order:[[sequelize.col('score'), orderStr]],
      limit:100
    }).catch(()=>{
      console.error("error")
    });
    if (item && item.length > 0) {
      res.send({code:0,data:item});
    } else {
      res.send({code:0,data:"查询失败"});
    }
  }
});

app.get("/api/user_game_data/:game_type?/:sub_type?",async (req,res) =>{
  const game_type = req.params.game_type;
  const sub_type = req.params.sub_type;
  console.log("获取玩家自己的游戏数据game_type = " + game_type,"sub_type = " + sub_type);
  if(game_type){
    const openid = req.headers["x-wx-openid"];
    const item = await user_game_data.findAll({
      where:{
        openid:openid,
        game_type:game_type,
      },
      limit:100
    });
    if (item && item.length > 0) {
      res.send({code:0,data:item});
    } else {
      res.send({code:0,data:"查询失败"});
    }
  }
});

app.post("/api/user_game_data",async (req,res) =>{
  const { game_data,user_info } = req.body;
  console.log("保存用户游戏数据",game_data,user_info);
  if (req.headers["x-wx-source"]) {
    const openid = req.headers["x-wx-openid"];
    let subType = game_data.sub_type;
    if(!subType){
      subType = 0;
    }
    const item = await user_game_data.findAll({
      where:{
        openid:openid,
        game_type:game_data.game_type,
        sub_type:subType
      }
    });

    if(game_data.game_type == 1002){
      const user_data_item = await user_data.findAll({
        where:{
          openid:openid,
        }
      }).catch((err)=>{
        console.error("user_data error---------",err);
      });;
      if(user_data_item && user_data_item.length > 0){
        let curScore = user_data_item[0].score;
        curScore += game_data.score;
        user_data_item[0].set({
          score:curScore
        });
        user_data_item[0].save();
        console.log("保存当前积分：",curScore)
      }
      else{
        user_data.create({
          openid:openid,
          nick_name:user_info.nickName,
          avatar_url:user_info.avatarUrl,
          score:game_data.score,
          skin_id:0,
        });
        console.log("创建角色数据",game_data.score);
      }
    }

    if(item && item.length > 0){
      let newRecord = false;
      if(game_data.game_type == 1001){
        //舒尔特挑战是按时间算，数值小的才算新记录
        newRecord = item[0].score > game_data.score;
      }
      else{
        newRecord = item[0].score < game_data.score;
      }
      let playTime = item[0].play_time;
      playTime += game_data.add_play_time;
      item[0].play_time = playTime;
      if(newRecord){
        item[0].set({
          score:game_data.score,
          record_time:game_data.record_time
        });
        await item[0].save();
        res.send({code:1,data:item});
      }
      else{
        await item[0].save();
        res.send({code:1,data:"未刷新记录"});
      }
    }
    else {
      const ugameData = await user_game_data.create({
        openid:openid,
        game_type:game_data.game_type,
        sub_type:subType,
        score:game_data.score,
        play_time:game_data.add_play_time,
        nick_name:user_info.nickName,
        avatar_url:user_info.avatarUrl,
        record_time:game_data.record_time
      });
      res.send({code:0,data:ugameData});
    }
  }
});

app.get("api/user_data",async(req,res)=>{
    if (req.headers["x-wx-source"]) {
        const openid = req.headers["x-wx-openid"];
        const item = await user_data.findAll({
          where:{
            openid:openid,
          }
        });
        if(item && item.length > 0){
          req.send({code:0,data:item[0]});
        }
        else{
          req.send({code:-1,data:"暂无数据"});
        }
    }
    else {
      req.send({code:0,data:"未登录授权"});
    }
});

app.post("api/use_grid_skin",async(req,res)=>{
  if (req.headers["x-wx-source"]) {
        const { skin_id } = req.body;
        const openid = req.headers["x-wx-openid"];
        const item = await user_data.findAll({
          where:{
            openid:openid,
          }
        });
        if(item && item.length > 0){
          item[0].skin_id = skin_id
          await item[0].save();
          req.send({code:0,data:skin_id});
        }
    }
    else {
      req.send({code:0,data:"未登录授权"});
    }
})

const port = process.env.PORT || 80;

async function bootstrap() {
  await initDB();
  await initUserDB();
  await initUser_data();
  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();