const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const game_config = require("./config/game_config");
const {
	initGameGridSave,
	game_grid_save_data,
} = require("./module/gameGrid/GameGridSaveDB");
const {
	initUser_game_data: initUserDB,
	user_game_data,
	initUser_data,
	user_data,
	initShare_rewards,
	share_rewards,
	sequelize,
} = require("./db");

const logger = morgan("tiny");
const regStr =
	"(?:[\uD83C\uDF00\uD83D\uDDFF\uD83E\uDD00\uDE00\uDE4F\uDE80\uDEFF\uDD71\uDD7E\uDD7F\uDD8E\uDD91\uDD9A\u20E3\u2194\u2199\u21A9\u21AA\u2B05\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3299])";
const regex = new RegExp(regStr, "g");
var app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

// 首页
app.get("/", async (req, res) => {
	res.sendFile(path.join(__dirname, "index.html"));
});


//#region 初始化玩家数据到内存。
var userAllData = {};
var rankListData = {};
var rankMap = {};
var playTimeRanks = [];
var playTimeRankMap = {};
var loopCount = 0;
function initRankData(num) {
	let offset = num * 1000;
	loopCount++;
	if (loopCount >= 1000) {
		console.log("排名数据已初始化" + loopCount);
		return;
	}
	user_game_data.findAndCountAll({ offset: offset, limit: 1000 }).then((result) => {
		let items = result.rows;
		for (let i = 0; i < items.length; i++) {
			let itemData = items[i];
			let key = itemData.game_type + "_" + itemData.sub_type;
			let list = userAllData[key];
			if (!list) {
				list = [];
				userAllData[key] = list;
			}
			list.push(itemData);
		}
		if (offset + 1000 >= result.count) {
			console.log("rank list init complete loopCount:" + loopCount);
			getAllRankList();
			loopCount = 9999;
			return;
		}
		let findNum = num + 1;
		initRankData(findNum);
	});
}

function getAllRankList() {
	if (!userAllData) {
		console.log("userAllData内存已清理");
		return;
	}
	for (let key in userAllData) {
		let list = userAllData[key];
		if (list) {
			let len = list.length;
			if (!len) continue;

			let order = "desc";
			if (list[0].game_type == 1001) {
				order = "asc";
			}
			if (list[0].game_type == 1002) {
				//消消乐游戏时长排序
				let playTimeList = list.slice();
				heapSort(playTimeList, order, "play_time");
				playTimeRanks = playTimeList.slice(0, 100);
				for (let i = 0; i < playTimeRanks.length; i++) {
					let openid = playTimeRanks[i].openid;
					if (!playTimeRankMap[openid]) playTimeRankMap[openid] = playTimeRanks[i];
				}
			}
			heapSort(list, order, "score");
			let newList = list.slice(0, 100);
			rankListData[key] = newList;
			let map = {};
			rankMap[key] = map;
			for (let i = 0; i < newList.length; i++) {
				let openid = newList[i].openid;
				if (!map[openid]) map[openid] = newList[i];
			}
		}
	}
	userAllData = null;
}
//#endregion

//#region 堆排序
function heapify(arr, n, i, order, targetName = "score") {
	let largest = i;
	let left = 2 * i + 1;
	let right = 2 * i + 2;

	if (left < n && compare(arr[left][targetName], arr[largest][targetName], order) === 1) {
		largest = left;
	}

	if (right < n && compare(arr[right][targetName], arr[largest][targetName], order) === 1) {
		largest = right;
	}

	if (largest != i) {
		let swap = arr[i];
		arr[i] = arr[largest];
		arr[largest] = swap;

		heapify(arr, n, largest, order, targetName);
	}
}

function heapSort(arr, order, targetName = "score") {
	let n = arr.length;
	for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
		heapify(arr, n, i, order, targetName);
	}

	for (let i = n - 1; i > 0; i--) {
		let temp = arr[0];
		arr[0] = arr[i];
		arr[i] = temp;

		heapify(arr, i, 0, order, targetName);
	}
}

function compare(a, b, order) {
	if (order === 'asc') {
		return a > b ? 1 : (a < b ? -1 : 0);//从小到大
	} else {
		return a < b ? 1 : (a > b ? -1 : 0);//从大到小
	}
}
//#endregion

// 小程序调用，获取微信 Open ID
app.get("/api/wx_openid", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		res.send(req.headers["x-wx-openid"]);
	}
});

var rankUpdateTime;
function checkRankUpdate(intervalTime) {
	let nowTime = Math.floor(Date.now() / 1000);
	if (!rankUpdateTime) {
		rankUpdateTime = new Date();
		rankUpdateTime.setTime(nowTime * 1000 + 28800000);
		rankUpdateTime.setHours(0, 0, 0, 0);
	}
	let lastTime = Math.floor(rankUpdateTime.getTime() / 1000) - 28800; //东八区，减8小时才是0点;
	if (nowTime - lastTime >= intervalTime) {
		rankUpdateTime.setTime(nowTime * 1000 + 28800000);
		rankUpdateTime.setHours(0, 0, 0, 0);
		return true;
	}
	return false;
}

//#region 排行榜数据获取
app.get("/api/all_user_game_data/:game_type?/:sub_type?", async (req, res) => {
	const game_type = req.params.game_type;
	const sub_type = req.params.sub_type;
	if (game_type) {
		let rankList;
		if (sub_type == 101) {
			rankList = playTimeRanks;
		}
		else {
			let findSubtype = 0;
			if (game_type == 1001) {
				findSubtype = sub_type;
			}
			let key = game_type + "_" + findSubtype;
			rankList = rankListData[key];
		}
		if (rankList && rankList.length > 0) {
			res.send({ code: 0, data: rankList });
		} else {
			res.send({ code: 0, data: "排名数据未初始化" });
		}
	}
});
//#endregion

app.get("/api/user_game_data/:game_type?/:sub_type?", async (req, res) => {
	const game_type = req.params.game_type;
	const sub_type = req.params.sub_type;
	// console.log("获取玩家自己的游戏数据game_type = " + game_type,"sub_type = " + sub_type);
	if (game_type) {
		const openid = req.headers["x-wx-openid"];
		const item = await user_game_data.findAll({
			where: {
				openid: openid,
				game_type: game_type,
			},
			limit: 100,
		});
		if (item && item.length > 0) {
			res.send({ code: 0, data: item });
		} else {
			res.send({ code: 0, data: "查询失败" });
		}
	}
});

//#region 保存游戏积分
//保存玩家游戏积分（货币）
async function addUserScore(openid, score, nickName) {
	let user_data_item = await user_data
		.findOne({
			where: {
				openid: openid,
			},
		})
		.catch(() => {
			console.error("user_data error---------");
		});
	if (user_data_item) {
		let curScore = user_data_item.score;
		curScore += score;
		user_data_item.score = curScore;
		if (nickName && nickName != "") {
			user_data_item.nick_name = nickName;
		}
		await user_data_item.save();
		return curScore;
		// console.log("保存当前积分：",curScore)
	} else {
		await user_data.create({
			openid: openid,
			nick_name: nickName,
			avatar_url: "",
			score: score,
			skin_id: 0,
			skin_list: "",
		});
		// console.log("创建角色数据",game_data.score);
	}
}
//#endregion

//#region 非法用户检查
function checkIllegalUser(openid) {
	let illegalCfg = game_config.illegal.getByPk(openid);
	if (illegalCfg) {
		return true;
	}
	return false;
}
//#endregion

//#region 保存游戏数据
app.post("/api/user_game_data", async (req, res) => {
	const { game_data, user_info } = req.body;
	let nickName = "神秘玩家";
	let avatarUrl = "";
	let filterEmojiName = "神秘玩家";
	if (user_info) {
		nickName = user_info.nickName;
		avatarUrl = user_info.avatarUrl;
		filterEmojiName = nickName.replace(regex, "");
	}
	console.log(
		"保存用户游戏数据name:" + nickName + "newName:" + filterEmojiName,
		game_data,
		user_info
	);
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		let subType = game_data.sub_type;
		let score = game_data.score;
		if (!subType) {
			subType = 0;
		}
		if (game_data.game_type == 1001) {
			if (checkIllegalUser(openid)) {
				console.log("违规用户:" + nickName, game_data, user_info);
				res.send({ code: -1, openid: openid });
				return;
			}
		}
		const item = await user_game_data.findOne({
			where: {
				openid: openid,
				game_type: game_data.game_type,
				sub_type: subType,
			},
		});
		let existData = item;
		if (!user_info && existData) {
			if (item.avatar_url && item.avatar_url != "") {
				//兼容已授权用户，后面又取消授权，取以前保存的旧数据显示
				console.log(filterEmojiName + item.id);
				filterEmojiName = item.nick_name;
				avatarUrl = item.avatar_url;
			} else {
				filterEmojiName = filterEmojiName + item.id;
			}
		}
		if (game_data.game_type == 1002) {
			await addUserScore(openid, game_data.score, filterEmojiName);
		}

		if (existData) {
			let newRecord = false;
			if (game_data.game_type == 1001) {
				//舒尔特挑战是按时间算，数值小的才算新记录
				newRecord = item.score > score;
			} else {
				newRecord = item.score < score;
			}
			let playTime = item.play_time;
			playTime += game_data.add_play_time;
			item.play_time = playTime;
			if (newRecord) {
				item.set({
					score: score,
					record_time: game_data.record_time,
					nick_name: filterEmojiName,
					avatar_url: avatarUrl,
				});
				await item.save();
				updateRank(item);
				res.send({ code: 0, data: item });
			} else {
				item.set({
					nick_name: filterEmojiName,
					avatar_url: avatarUrl,
				});
				await item.save();
				updatePlayTimeRank(item);
				res.send({ code: 0, data: "未刷新记录" });
			}
		} else {
			const ugameData = await user_game_data.create({
				openid: openid,
				game_type: game_data.game_type,
				sub_type: subType,
				score: score,
				play_time: game_data.add_play_time,
				nick_name: filterEmojiName,
				avatar_url: avatarUrl,
				record_time: game_data.record_time,
			});
			updateRank(ugameData);
			res.send({ code: 0, data: ugameData });
		}
	}
});

function updateRank(data) {
	if (!data || !rankListData) return;
	let key = data.game_type + "_" + data.sub_type;
	let list = rankListData[key];
	let lastRank;
	let order = "";
	let map = rankMap[key];
	if (!list) {
		list = [data];
		rankListData[key] = list;
		map = {};
		map[data.openid] = data;
		rankMap[key] = map;
	}
	else {
		lastRank = map[data.openid];
	}
	if (lastRank) {
		//已经在榜上
		lastRank.score = data.score;
		if (data.game_type == 1001) {
			order = "asc";
		}
		else {
			order = "desc";
			updatePlayTimeRank(data);
		}
	}
	else {
		lastRank = list[list.length - 1];
		if (data.game_type == 1001) {
			if (data.score < lastRank.score) {
				order = "asc";//舒尔特，从小到大
				//用时更短
				delete map[lastRank.openid];
				list[list.length - 1] = data;
				map[data.openid] = data;
			}
		}
		else {
			if (data.score > lastRank.score) {
				order = "desc";//默认从大到小排序
				//得分更多
				delete map[lastRank.openid];
				list[list.length - 1] = data;
				map[data.openid] = data;
			}
			updatePlayTimeRank(data);
		}
	}
	if (order && order != "") {
		heapSort(list, order, "score");
	}
}

function updatePlayTimeRank(data) {
	if (data.game_type == 1002 && playTimeRanks && playTimeRanks.length > 0) {
		let temp = playTimeRankMap[data.openid];
		if (temp) {
			temp.play_time = data.play_time;
			heapSort(playTimeRanks, "desc", "play_time");
		}
		else {
			temp = playTimeRanks[playTimeRanks.length - 1];
			if (temp.play_time < data.play_time) {
				//消消乐游玩时间更长，替换排名
				delete playTimeRankMap[temp.openid];
				playTimeRanks[playTimeRanks.length - 1] = data;
				playTimeRankMap[data.openid] = data;
				heapSort(playTimeRanks, "desc", "play_time");
			}
		}
	}
}
//#endregion

app.get("/api/user_data", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		const item = await user_data.findOne({
			where: {
				openid: openid,
			},
		});
		if (item) {
			res.send({ code: 0, data: item });
		} else {
			res.send({ code: -1, data: "暂无数据" });
		}
	} else {
		res.send({ code: -1, data: "未登录授权" });
	}
});

app.post("/api/add_score_coin", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		const { score } = req.body;
		const newScore = await addUserScore(openid, score);
		res.send({ code: 0, data: { score: newScore } });
	}
});

//#region 兑换皮肤
//兑换皮肤
app.post("/api/buy_skin", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		const { skin_id } = req.body;
		let user_data_item = await user_data
			.findOne({
				where: {
					openid: openid,
				},
			})
			.catch(() => {
				console.error("user_data error--------");
			});

		if (user_data_item) {
			let item = user_data_item;
			let skinListStr = item.skin_list;
			let skinList;
			if (skinListStr && skinListStr != "") {
				skinList = skinListStr.split(",");
			} else {
				skinListStr = "";
				skinList = [];
			}
			// console.log("当前皮肤列表",skinList,skinList.length);
			if (skinList.indexOf(String(skin_id)) != -1) {
				res.send({ code: 0, data: "已拥有skin_id:" + skin_id });
			} else {
				let shopCfg = game_config.shop.getByPk(skin_id);
				if (!shopCfg) {
					// console.log("shop配置错误:",skin_id,game_config.shop);
				} else {
					if (item.score >= shopCfg.price) {
						if (skinList.length == 0) {
							skinListStr += "" + skin_id;
						} else {
							skinListStr += "," + skin_id;
						}
						item.skin_list = skinListStr;
						let newScore = item.score - shopCfg.price;
						item.score = newScore;
						await item.save();
						res.send({ code: 0, data: { skin_id: skin_id, score: newScore } });
					} else {
						res.send({ code: 0, data: "积分不足" });
					}
				}
			}
		}
	}
});
//#endregion

//#region 使用皮肤
app.post("/api/use_grid_skin", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const { skin_id } = req.body;
		const openid = req.headers["x-wx-openid"];
		const item = await user_data.findOne({
			where: {
				openid: openid,
			},
		});
		if (item) {
			item.skin_id = skin_id;
			await item.save();
			res.send({ code: 0, data: { skin_id: skin_id } });
		}
	} else {
		res.send({ code: -1, data: "未登录授权" });
	}
});
//#endregion

//#region 跨天检测
//判断time 距离当前时间是否24小时以上了
var checkDate = new Date();
function checkNextDay(time) {
	checkDate.setTime(time * 1000 + 28800000);
	//上次领奖时间，重置到0点
	checkDate.setHours(0, 0, 0, 0);
	let nowTime = Math.floor(Date.now() / 1000);
	let lastTime = Math.floor(checkDate.getTime() / 1000) - 28800; //东八区，减8小时才是0点;
	// console.log("checkNextDay nowTime：" + nowTime,"lastTime：" + lastTime,"time：" + time,tDate);
	//判断是否跨天 24*60*60
	return nowTime - lastTime >= 86400;
}
//#endregion

//#region分享奖励
// 获取领奖状态
app.get("/api/share_score_reward", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		const item = await share_rewards.findOne({
			where: {
				openid: openid,
			},
		});
		if (item) {
			let shareTime = item.share_time;
			let hadGet = 1;
			if (checkNextDay(shareTime)) {
				//超过24小时，可继续领取
				hadGet = 0;
			}
			res.send({ code: 0, data: { had_get: hadGet } });
		} else {
			//找不到数据，未领取状态
			res.send({ code: 0, data: { had_get: 0 } });
		}
	} else {
		res.send({ code: -1, data: "未登录授权" });
	}
});

app.post("/api/share_score_reward", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		const nowTime = Math.floor(Date.now() / 1000);
		const item = await share_rewards.findOne({
			where: {
				openid: openid,
			},
		});
		if (item) {
			let shareTime = item.share_time;
			if (checkNextDay(shareTime)) {
				//可下发奖励
				let count = item.share_count;
				item.share_count = count + 1;
				item.share_time = nowTime;
				await item.save();
				await addUserScore(openid, 100);
				res.send({ code: 0, data: { score: 100 } });
			} else {
				res.send({ code: -1, data: "已领取奖励，还未刷新重置" });
			}
		} else {
			//数据库没有保存，直接判定是可领取状态
			await share_rewards.create({
				openid: openid,
				share_time: nowTime,
				share_count: 1,
			});
			await addUserScore(openid, 100);
			res.send({ code: 0, data: { score: 100 } });
		}
	} else {
		res.send({ code: -1, data: "未登录授权" });
	}
});
//#endregion

//#region 游戏进度保存
app.post("/api/game_grid_save", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		const { jsonStr } = req.body;
		const item = await game_grid_save_data.findOne({
			where: { openid: openid },
		});
		if (item) {
			item.data_str = jsonStr;
			item.is_valid = 1;
			await item.save();
			res.send({ code: 0, data: { result: "保存成功" } });
		} else {
			await game_grid_save_data.create({
				openid: openid,
				data_str: jsonStr,
				is_valid: 1,
			});
			res.send({ code: 0, data: { result: "保存成功" } });
		}
	}
});

app.get("/api/game_grid_save", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		const item = await game_grid_save_data.findOne({
			where: { openid: openid },
		});
		if (item) {
			let jsonStr = item.data_str;
			let is_valid = item.is_valid;
			if (is_valid == 1) {
				item.is_valid = 0;
				await item.save();
				res.send({ code: 0, data: jsonStr });
			} else {
				res.send({ code: -1, data: "数据已失效" });
			}
		} else {
			res.send({ code: -1, data: "暂无数据" });
		}
	}
});
//#endregion

//#region 测试
app.get("/api/get_rank_data", async (req, res) => {
	getAllRankList();
	res.send({ code: 0, data: rankListData });
});
//#endregion

const port = process.env.PORT || 80;
async function bootstrap() {
	await initUserDB();
	await initUser_data();
	await initShare_rewards();
	await initGameGridSave();
	app.listen(port, () => {
		console.log("启动成功", port);
		initRankData(0);
	});
}

bootstrap();
