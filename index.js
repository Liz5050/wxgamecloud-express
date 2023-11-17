const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const game_config = require("./config/game_config");
const { 
  // init: initDB, 
  // Counter, 
  initUser_game_data:initUserDB, 
  user_game_data,
  initUser_data,
  user_data,
  initShare_rewards,
  share_rewards,
  sequelize} = require("./db");

const logger = morgan("tiny");
const regStr = "(?:[\uD83C\uDF00\uD83D\uDDFF\uD83E\uDD00\uDE00\uDE4F\uDE80\uDEFF\uDD71\uDD7E\uDD7F\uDD8E\uDD91\uDD9A\u20E3\u2194\u2199\u21A9\u21AA\u2B05\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3299])";
const regex = new RegExp(regStr,"g");
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
// app.post("/api/count", async (req, res) => {
//   const { action } = req.body;
//   if (action === "inc") {
//     await Counter.create();
//   } else if (action === "clear") {
//     await Counter.destroy({
//       truncate: true,
//     });
//   }
//   res.send({
//     code: 0,
//     data: await Counter.count(),
//   });
// });

// // 获取计数
// app.get("/api/count", async (req, res) => {
//   const result = await Counter.count();
//   res.send({
//     code: 0,
//     data: result,
//   });
// });

// 小程序调用，获取微信 Open ID
app.get("/api/wx_openid", async (req, res) => {
  if (req.headers["x-wx-source"]) {
    res.send(req.headers["x-wx-openid"]);
  }
});

app.get("/api/all_user_game_data/:game_type?/:sub_type?",async (req,res) =>{
  const game_type = req.params.game_type;
  const sub_type = req.params.sub_type;
  // console.log("获取所有玩家的游戏数据game_type = " + game_type,"sub_type = " + sub_type);
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
  // console.log("获取玩家自己的游戏数据game_type = " + game_type,"sub_type = " + sub_type);
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

//保存玩家游戏积分（货币）
async function addUserScore(openid,score,nickName){
  const user_data_item = await user_data.findAll({
    where:{
      openid:openid,
    }
  }).catch(()=>{
    console.error("user_data error---------");
  });
  if(user_data_item && user_data_item.length > 0){
    let curScore = user_data_item[0].score;
    curScore += score;
    user_data_item[0].score = curScore;
    if(nickName && nickName != ""){
      user_data_item[0].nick_name = nickName;
    }
    await user_data_item[0].save();
    return curScore;
    // console.log("保存当前积分：",curScore)
  }
  else{
    await user_data.create({
      openid:openid,
      nick_name:nickName,
      avatar_url:"",
      score:score,
      skin_id:0,
      skin_list:""
    });
    // console.log("创建角色数据",game_data.score);
  }
}

app.post("/api/user_game_data",async (req,res) =>{
  const { game_data,user_info } = req.body;
  let nickName = "神秘玩家";
  let avatarUrl = "";
  let filterEmojiName = "神秘玩家";
  if(user_info){
    nickName = user_info.nickName;
    avatarUrl = user_info.avatarUrl;
    filterEmojiName = nickName.replace(regex,"");
  }
  console.log("保存用户游戏数据name:" + nickName + "newName:" + filterEmojiName,game_data,user_info);
  if (req.headers["x-wx-source"]) {
    const openid = req.headers["x-wx-openid"];
    let subType = game_data.sub_type;
    let score = game_data.score;
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
    
    let existData = item && item.length > 0;
    if(!user_info && existData){
      if(item[0].avatar_url && item[0].avatar_url != ""){
        //兼容已授权用户，后面又取消授权，取以前保存的旧数据显示
        console.log(filterEmojiName + item[0].id);
        filterEmojiName = item[0].nick_name;
        avatarUrl = item[0].avatar_url;
      }
      else {
        filterEmojiName = filterEmojiName + item[0].id;
      }
    }
    if(game_data.game_type == 1002){
      await addUserScore(openid,game_data.score,filterEmojiName);
    }

    if(existData){
      let newRecord = false;
      if(game_data.game_type == 1001){
        //舒尔特挑战是按时间算，数值小的才算新记录
        newRecord = item[0].score > score;
      }
      else{
        newRecord = item[0].score < score;
      }
      let playTime = item[0].play_time;
      playTime += game_data.add_play_time;
      item[0].play_time = playTime;
      if(newRecord){
        item[0].set({
          score:score,
          record_time:game_data.record_time,
          nick_name:filterEmojiName,
          avatar_url:avatarUrl,
        });
        await item[0].save();
        res.send({code:0,data:item});
      }
      else{
        await item[0].save();
        res.send({code:0,data:"未刷新记录"});
      }
    }
    else {
      const ugameData = await user_game_data.create({
        openid:openid,
        game_type:game_data.game_type,
        sub_type:subType,
        score:score,
        play_time:game_data.add_play_time,
        nick_name:filterEmojiName,
        avatar_url:avatarUrl,
        record_time:game_data.record_time
      });
      res.send({code:0,data:ugameData});
    }
  }
});

app.get("/api/user_data",async(req,res)=>{
    if (req.headers["x-wx-source"]) {
        const openid = req.headers["x-wx-openid"];
        const item = await user_data.findAll({
          where:{
            openid:openid,
          }
        });
        if(item && item.length > 0){
          res.send({code:0,data:item[0]});
        }
        else{
          res.send({code:-1,data:"暂无数据"});
        }
    }
    else {
      res.send({code:-1,data:"未登录授权"});
    }
});

app.post("/api/add_score_coin",async(req,res)=>{
  if (req.headers["x-wx-source"]) {
    const openid = req.headers["x-wx-openid"];
    const { score } = req.body;
    const newScore = await addUserScore(openid,score);
    res.send({code:0,data:{score:newScore}});
  }
});

//兑换皮肤
app.post("/api/buy_skin",async(req,res)=>{
  if (req.headers["x-wx-source"]) {
    const openid = req.headers["x-wx-openid"];
    const { skin_id } = req.body;
    const user_data_item = await user_data.findAll({
      where:{
        openid:openid,
      }
    }).catch(()=>{
      console.error("user_data error--------");
    });

    if(user_data_item && user_data_item.length > 0){
      let item = user_data_item[0]
      let skinListStr = item.skin_list;
      let skinList;
      if(skinListStr && skinListStr != ""){
        skinList = skinListStr.split(",");
      }
      else{
        skinListStr = "";
        skinList = [];
      }
      // console.log("当前皮肤列表",skinList,skinList.length);
      if(skinList.indexOf(String(skin_id)) != -1){
        res.send({code:0,data:"已拥有skin_id:" + skin_id});
      }
      else{
        let shopCfg = game_config.shop.getByPk(skin_id);
        if(!shopCfg){
          // console.log("shop配置错误:",skin_id,game_config.shop);
        }
        else {
          if(item.score >= shopCfg.price){
            if(skinList.length == 0){
              skinListStr += "" + skin_id;
            }
            else{
              skinListStr += "," + skin_id;
            }
            item.skin_list = skinListStr;
            let newScore = item.score - shopCfg.price;
            item.score = newScore;
            await item.save();
            res.send({code:0,data:{skin_id:skin_id,score:newScore}});
          }
          else {
            res.send({code:0,data:"积分不足"});
          }
        }
      }
    }
  }
});

app.post("/api/use_grid_skin",async(req,res)=>{
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
          res.send({code:0,data:{skin_id:skin_id}});
        }
    }
    else {
      res.send({code:-1,data:"未登录授权"});
    }
})

//判断time 距离当前时间是否24小时以上了
var checkDate = new Date();
function checkNextDay(time){
  checkDate.setTime(time * 1000 + 28800000);
  //上次领奖时间，重置到0点
  checkDate.setHours(0,0,0,0);
  let nowTime = Math.floor(Date.now() / 1000);
  let lastTime = Math.floor(checkDate.getTime() / 1000) - 28800;//东八区，减8小时才是0点;
  // console.log("checkNextDay nowTime：" + nowTime,"lastTime：" + lastTime,"time：" + time,tDate);
  //判断是否跨天 24*60*60
  return nowTime - lastTime >= 86400;
}

//分享奖励
// 获取领奖状态
app.get("/api/share_score_reward",async(req,res)=>{
  if (req.headers["x-wx-source"]) {
    const openid = req.headers["x-wx-openid"];
    const item = await share_rewards.findAll({
      where:{
        openid:openid,
      }
    });
    if(item && item.length > 0){
      let shareTime = item[0].share_time;
      let hadGet = 1;
      if(checkNextDay(shareTime)){
        //超过24小时，可继续领取
        hadGet = 0;
      }
      res.send({code:0,data:{had_get:hadGet}});
    }
    else{
      //找不到数据，未领取状态
      res.send({code:0,data:{had_get:0}});
    }
  }
  else {
    res.send({code:-1,data:"未登录授权"});
  }
})

app.post("/api/share_score_reward",async(req,res)=>{
  if (req.headers["x-wx-source"]) {
    const openid = req.headers["x-wx-openid"];
    const nowTime = Math.floor(Date.now() / 1000);
    const item = await share_rewards.findAll({
      where:{
        openid:openid,
      }
    });
    if(item && item.length > 0){
      let shareTime = item[0].share_time;
      if(checkNextDay(shareTime)){
        //可下发奖励
        let count = item[0].share_count;
        item[0].share_count = count + 1;
        item[0].share_time = nowTime;
        await item[0].save();
        await addUserScore(openid,100);
        res.send({code:0,data:{score:100}});
      }
      else{
        res.send({code:-1,data:"已领取奖励，还未刷新重置"});
      }
    }
    else{
      //数据库没有保存，直接判定是可领取状态
      await share_rewards.create({
        openid:openid,
        share_time:nowTime,
        share_count:1
      });
      await addUserScore(openid,100);
      res.send({code:0,data:{score:100}});
    }
  }
  else {
    res.send({code:-1,data:"未登录授权"});
  }
})

const port = process.env.PORT || 80;

async function bootstrap() {
  await initUserDB();
  await initUser_data();
  await initShare_rewards();
  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();
module.exports = {app};