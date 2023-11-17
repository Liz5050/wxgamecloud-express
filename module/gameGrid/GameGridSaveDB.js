const { DataTypes } = require("sequelize");
const {sequelize} = require("../../db.js");
const index = require("../../index.js");
var isInit = false;
const game_grid_save_data = sequelize.define("game_grid_save_data", {
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
})

async function initGameGridSave() {
	if(!isInit){
		isInit = true;
		await game_grid_save_data.sync();
	}
}

index.app.post("/api/game_grid_save",async(req,res)=>{
	await initGameGridSave();
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		const { jsonStr } = req.body;
		const item = await game_grid_save_data.findAll({
			where:{openid:openid}
		});
		if(item && item.length > 0){
			item[0].data_str = jsonStr;
			item[0].is_valid = 1;
			await item[0].save();
			res.send({code:0,data:{result:"保存成功"}});
		}
		else{
			await game_grid_save_data.create({
				openid:openid,
				data_str:jsonStr,
				is_valid:1
			});
			res.send({code:0,data:{result:"保存成功"}});
		}
	}
})

index.app.get("/api/game_grid_save",async(req,res)=>{
	await initGameGridSave();
	if (req.headers["x-wx-source"]) {
        const openid = req.headers["x-wx-openid"];
		const item = await game_grid_save_data.findAll({
			where:{openid:openid}
		});
		if(item && item.length > 0){
			let jsonStr = item[0].data_str;
			let is_valid = item[0].is_valid;
			if(is_valid == 1){
				item[0].is_valid = 0;
				await item[0].save(); 
				res.send({code:0,data:jsonStr});
			}
			else{
				res.send({code:-1,data:"数据已失效"});
			}
		}
		else{
			res.send({code:-1,data:"暂无数据"});
		}
	}
})