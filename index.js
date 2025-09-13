// 加载环境变量
require('dotenv').config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const game_config = require("./config/game_config");
const DatabaseCleaner = require('./databaseCleaner');
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
	Op
} = require("./db");
const { PerformanceMonitor, createPerformanceMiddleware } = require('./performanceMonitor');

const logger = morgan("tiny");
const regStr =
	"(?:[\uD83C\uDF00\uD83D\uDDFF\uD83E\uDD00\uDE00\uDE4F\uDE80\uDEFF\uDD71\uDD7E\uDD7F\uDD8E\uDD91\uDD9A\u20E3\u2194\u2199\u21A9\u21AA\u2B05\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3299])";
const regex = new RegExp(regStr, "g");
var app = express();

// 初始化性能监控
const performanceMonitor = new PerformanceMonitor();
app.use(createPerformanceMiddleware(performanceMonitor));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

// 首页
app.get("/", async (req, res) => {
	res.sendFile(path.join(__dirname, "index.html"));
});

// 性能监控接口
app.get("/api/performance", (req, res) => {
	const report = performanceMonitor.getPerformanceReport();
	res.send({ code: 0, data: report });
});

// 清理缓存接口
app.post("/api/clear-cache", (req, res) => {
	rankCache.clear();
	cacheExpiry.clear();
	console.log('🧹 清理排行榜缓存');
	res.send({ code: 0, data: '缓存已清理' });
});

//#region 优化后的排行榜数据管理 - 使用数据库查询替代内存存储
// 使用数据库查询替代内存存储，大幅减少内存占用
var rankCache = new Map();
var cacheExpiry = new Map();
const CACHE_TTL = 30000; // 30秒缓存

// 清空过期的缓存 - 安全的内存管理
function cleanupExpiredCache() {
	const now = Date.now();
	let clearedCount = 0;
	
	for (const [key, expiry] of cacheExpiry.entries()) {
		if (now > expiry) {
			rankCache.delete(key);
			cacheExpiry.delete(key);
			clearedCount++;
		}
	}
	
	// 如果缓存条目过多，强制清理最旧的50%以防止内存泄漏
	if (rankCache.size > 1000) {
		const keys = Array.from(rankCache.keys());
		const keysToRemove = keys.slice(0, Math.floor(keys.length * 0.5));
		
		keysToRemove.forEach(key => {
			rankCache.delete(key);
			cacheExpiry.delete(key);
		});
		
		console.log(`⚠️  缓存清理: 强制移除${keysToRemove.length}个旧缓存条目`);
	}
	
	if (clearedCount > 0) {
		console.log(`🧹 自动清理${clearedCount}个过期缓存条目`);
	}
}

// 每2分钟清理一次过期缓存（更频繁的清理）
setInterval(cleanupExpiredCache, 120000);

// 获取排行榜数据 - 使用数据库查询和缓存
async function getRankList(game_type, sub_type = 0) {
	const cacheKey = `${game_type}_${sub_type}`;
	const now = Date.now();
	
	// 检查缓存
	if (rankCache.has(cacheKey) && cacheExpiry.get(cacheKey) > now) {
		return rankCache.get(cacheKey);
	}
	
	let order = 'DESC';
	let targetName = 'score';
	let whereCondition = { game_type };
	
	// 特殊处理：1002类型的subtype在数据库中都是0，但客户端可能请求100
	if (game_type == 1002 && (sub_type == 100 || sub_type == 101)) {
		whereCondition.sub_type = 0; // 查询数据库中实际存储的subtype=0
	} else {
		whereCondition.sub_type = sub_type;
	}
	
	if (game_type == 1001) {
		order = 'ASC'; // 舒尔特挑战按时间升序
	} else if (game_type == 1002 && sub_type == 101) {
		targetName = 'play_time'; // 消消乐游戏时长
	}
	
	try {
		const result = await user_game_data.findAll({
			where: whereCondition,
			order: [[targetName, order]],
			limit: 100,
			attributes: ['openid', 'game_type', 'sub_type', 'score', 'play_time', 'nick_name', 'avatar_url', 'record_time']
		});
		
		// 设置缓存
		rankCache.set(cacheKey, result);
		cacheExpiry.set(cacheKey, now + CACHE_TTL);
		
		return result;
	} catch (error) {
		console.error('获取排行榜数据失败:', error);
		return [];
	}
}

// 获取用户排名
async function getUserRank(openid, game_type, sub_type = 0) {
	try {
		const result = await user_game_data.findOne({
			where: { openid, game_type, sub_type },
			attributes: ['openid', 'game_type', 'sub_type', 'score', 'play_time', 'nick_name', 'avatar_url', 'record_time']
		});
		
		if (!result) return null;
		
		// 计算排名
		const count = await user_game_data.count({
			where: { 
				game_type, 
				sub_type,
				score: game_type == 1001 ? 
					{ [Op.lt]: result.score } : // 舒尔特挑战：分数越小排名越高
					{ [Op.gt]: result.score }   // 其他游戏：分数越大排名越高
			}
		});
		
		return {
			...result.toJSON(),
			rank: count + 1
		};
	} catch (error) {
		console.error('获取用户排名失败:', error);
		return null;
	}
}
//#endregion

//#region 堆排序函数（保留但不再使用）
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

//#region 排行榜数据获取 - 优化为数据库查询
app.get("/api/all_user_game_data/:game_type?/:sub_type?", async (req, res) => {
	const game_type = parseInt(req.params.game_type);
	const sub_type = parseInt(req.params.sub_type || 0);
	
	if (game_type) {
		try {
			let rankList;
			if (game_type == 1002 && sub_type == 101) {
				// 消消乐游戏时长排行榜
				rankList = await getRankList(game_type, sub_type);
			} else {
				// 其他排行榜
				rankList = await getRankList(game_type, sub_type);
			}
			
			if (rankList && rankList.length > 0) {
				res.send({ code: 0, data: rankList });
			} else {
				res.send({ code: 0, data: [] });
			}
		} catch (error) {
			console.error('获取排行榜数据错误:', error);
			res.send({ code: -1, data: "服务器错误" });
		}
	} else {
		res.send({ code: -1, data: "参数错误" });
	}
});
//#endregion

app.get("/api/user_game_data/:game_type?/:sub_type?", async (req, res) => {
	const game_type = parseInt(req.params.game_type);
	const sub_type = parseInt(req.params.sub_type || 0);
	
	if (game_type) {
		const openid = req.headers["x-wx-openid"];
		try {
			let whereCondition = {
				openid: openid,
				game_type: game_type
			};
			
			// 特殊处理：1002类型的subtype在数据库中都是0，但客户端可能请求100
			if (game_type == 1002 && sub_type == 100) {
				whereCondition.sub_type = 0; // 查询数据库中实际存储的subtype=0
			} else {
				whereCondition.sub_type = sub_type;
			}
			
			const item = await user_game_data.findAll({
				where: whereCondition,
				limit: 100,
				attributes: ['openid', 'game_type', 'sub_type', 'score', 'play_time', 'nick_name', 'avatar_url', 'record_time']
			});
			
			if (item && item.length > 0) {
				res.send({ code: 0, data: item });
			} else {
				res.send({ code: 0, data: [] });
			}
		} catch (error) {
			console.error('查询用户游戏数据错误:', error);
			res.send({ code: -1, data: "查询失败" });
		}
	}
});

//#region 保存玩家游戏积分（货币）
async function addUserScore(openid, score, nickName) {
	try {
		let user_data_item = await user_data
			.findOne({
				where: { openid: openid },
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
		} else {
			await user_data.create({
				openid: openid,
				nick_name: nickName,
				avatar_url: "",
				score: score,
				skin_id: 0,
				skin_list: "",
			});
			return score;
		}
	} catch (error) {
		console.error('保存用户积分错误:', error);
		throw error;
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

//#region 保存游戏数据 - 优化数据库操作
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
		let subType = game_data.sub_type || 0;
		let score = game_data.score;
		
		try {
			if (game_data.game_type == 1001) {
				if (checkIllegalUser(openid)) {
					console.log("违规用户:" + nickName, game_data, user_info);
					res.send({ code: -1, openid: openid });
					return;
				}
			}

			// 使用事务确保数据一致性
			const result = await sequelize.transaction(async (t) => {
				const item = await user_game_data.findOne({
					where: {
						openid: openid,
						game_type: game_data.game_type,
						sub_type: subType,
					},
					transaction: t
				});

				let existData = item;
				
				if (!user_info && existData) {
					if (item.avatar_url && item.avatar_url != "") {
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
						newRecord = item.score > score;
					} else {
						newRecord = item.score < score;
					}
					
					let playTime = item.play_time;
					playTime += game_data.add_play_time || 0;
					item.play_time = playTime;
					
					if (newRecord) {
						item.set({
							score: score,
							record_time: game_data.record_time,
							nick_name: filterEmojiName,
							avatar_url: avatarUrl,
						});
						await item.save({ transaction: t });
						return { code: 0, data: item, isNewRecord: true };
					} else {
						item.set({
							nick_name: filterEmojiName,
							avatar_url: avatarUrl,
						});
						await item.save({ transaction: t });
						return { code: 0, data: "未刷新记录", isNewRecord: false };
					}
				} else {
					const ugameData = await user_game_data.create({
						openid: openid,
						game_type: game_data.game_type,
						sub_type: subType,
						score: score,
						play_time: game_data.add_play_time || 0,
						nick_name: filterEmojiName,
						avatar_url: avatarUrl,
						record_time: game_data.record_time,
					}, { transaction: t });
					return { code: 0, data: ugameData, isNewRecord: true };
				}
			});

			res.send(result);
		} catch (error) {
			console.error('保存游戏数据错误:', error);
			res.send({ code: -1, data: "保存失败" });
		}
	}
});
//#endregion

app.get("/api/user_data", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		try {
			const item = await user_data.findOne({
				where: { openid: openid },
				attributes: ['openid', 'nick_name', 'avatar_url', 'score', 'skin_id', 'skin_list']
			});
			
			if (item) {
				res.send({ code: 0, data: item });
			} else {
				res.send({ code: -1, data: "暂无数据" });
			}
		} catch (error) {
			console.error('查询用户数据错误:', error);
			res.send({ code: -1, data: "查询失败" });
		}
	} else {
		res.send({ code: -1, data: "未登录授权" });
	}
});

app.post("/api/add_score_coin", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		const { score } = req.body;
		try {
			const newScore = await addUserScore(openid, score);
			res.send({ code: 0, data: { score: newScore } });
		} catch (error) {
			console.error('添加积分错误:', error);
			res.send({ code: -1, data: "添加积分失败" });
		}
	}
});

//#region 兑换皮肤
app.post("/api/buy_skin", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		const { skin_id } = req.body;
		try {
			let user_data_item = await user_data
				.findOne({
					where: { openid: openid },
				})
				.catch(() => {
					console.error("user_data error--------");
				});

			if (user_data_item) {
				let skinListStr = user_data_item.skin_list;
				let skinList;
				if (skinListStr && skinListStr != "") {
					skinList = skinListStr.split(",");
				} else {
					skinListStr = "";
					skinList = [];
				}
				
				if (skinList.indexOf(String(skin_id)) != -1) {
					res.send({ code: 0, data: "已拥有skin_id:" + skin_id });
					return;
				}
				
				let shopCfg = game_config.shop.getByPk(skin_id);
				if (!shopCfg) {
					res.send({ code: -1, data: "商品配置错误" });
					return;
				}
				
				if (user_data_item.score >= shopCfg.price) {
					if (skinList.length == 0) {
						skinListStr += "" + skin_id;
					} else {
						skinListStr += "," + skin_id;
					}
					user_data_item.skin_list = skinListStr;
					let newScore = user_data_item.score - shopCfg.price;
					user_data_item.score = newScore;
					await user_data_item.save();
					res.send({ code: 0, data: { skin_id: skin_id, score: newScore } });
				} else {
					res.send({ code: 0, data: "积分不足" });
				}
			}
		} catch (error) {
			console.error('购买皮肤错误:', error);
			res.send({ code: -1, data: "购买失败" });
		}
	}
});
//#endregion

//#region 使用皮肤
app.post("/api/use_grid_skin", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const { skin_id } = req.body;
		const openid = req.headers["x-wx-openid"];
		try {
			const item = await user_data.findOne({
				where: { openid: openid },
				attributes: ['openid', 'skin_id', 'skin_list']
			});
			
			if (item) {
				// 检查用户是否拥有该皮肤
				const skinList = item.skin_list ? item.skin_list.split(",") : [];
				if (skinList.includes(String(skin_id))) {
					item.skin_id = skin_id;
					await item.save();
					res.send({ code: 0, data: { skin_id: skin_id } });
				} else {
					res.send({ code: -1, data: "未拥有该皮肤" });
				}
			} else {
				res.send({ code: -1, data: "用户不存在" });
			}
		} catch (error) {
			console.error('使用皮肤错误:', error);
			res.send({ code: -1, data: "使用皮肤失败" });
		}
	} else {
		res.send({ code: -1, data: "未登录授权" });
	}
});
//#endregion

//#region 跨天检测
function checkNextDay(time) {
	let checkDate = new Date(time * 1000 + 28800000);
	checkDate.setHours(0, 0, 0, 0);
	let nowTime = Math.floor(Date.now() / 1000);
	let lastTime = Math.floor(checkDate.getTime() / 1000) - 28800;
	return nowTime - lastTime >= 86400;
}
//#endregion

//#region分享奖励
app.get("/api/share_score_reward", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		try {
			const item = await share_rewards.findOne({
				where: { openid: openid },
				attributes: ['share_time']
			});
			
			if (item) {
				let hadGet = checkNextDay(item.share_time) ? 0 : 1;
				res.send({ code: 0, data: { had_get: hadGet } });
			} else {
				res.send({ code: 0, data: { had_get: 0 } });
			}
		} catch (error) {
			console.error('获取分享奖励状态错误:', error);
			res.send({ code: -1, data: "查询失败" });
		}
	} else {
		res.send({ code: -1, data: "未登录授权" });
	}
});

app.post("/api/share_score_reward", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		const nowTime = Math.floor(Date.now() / 1000);
		try {
			const item = await share_rewards.findOne({
				where: { openid: openid },
			});
			
			if (item) {
				if (checkNextDay(item.share_time)) {
					item.share_count += 1;
					item.share_time = nowTime;
					await item.save();
					await addUserScore(openid, 100);
					res.send({ code: 0, data: { score: 100 } });
				} else {
					res.send({ code: -1, data: "已领取奖励，还未刷新重置" });
				}
			} else {
				await share_rewards.create({
					openid: openid,
					share_time: nowTime,
					share_count: 1,
				});
				await addUserScore(openid, 100);
				res.send({ code: 0, data: { score: 100 } });
			}
		} catch (error) {
			console.error('领取分享奖励错误:', error);
			res.send({ code: -1, data: "领取失败" });
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
		try {
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
		} catch (error) {
			console.error('保存游戏进度错误:', error);
			res.send({ code: -1, data: "保存失败" });
		}
	}
});

app.get("/api/game_grid_save", async (req, res) => {
	if (req.headers["x-wx-source"]) {
		const openid = req.headers["x-wx-openid"];
		try {
			const item = await game_grid_save_data.findOne({
				where: { openid: openid },
				attributes: ['data_str', 'is_valid']
			});
			
			if (item) {
				if (item.is_valid == 1) {
					item.is_valid = 0;
					await item.save();
					res.send({ code: 0, data: item.data_str });
				} else {
					res.send({ code: -1, data: "数据已失效" });
				}
			} else {
				res.send({ code: -1, data: "暂无数据" });
			}
		} catch (error) {
			console.error('获取游戏进度错误:', error);
			res.send({ code: -1, data: "获取失败" });
		}
	}
});
//#endregion

//#region 测试
app.get("/api/get_rank_data", async (req, res) => {
	try {
		// 清空缓存，重新获取最新数据
		rankCache.clear();
		cacheExpiry.clear();
		
		// 获取所有游戏类型的排行榜
		const gameTypes = [1001, 1002];
		const results = {};
		
		for (const gameType of gameTypes) {
			results[gameType] = await getRankList(gameType, 0);
			if (gameType === 1002) {
				results['1002_101'] = await getRankList(1002, 101);
			}
		}
		
		res.send({ code: 0, data: results });
	} catch (error) {
		console.error('获取测试排行榜数据错误:', error);
		res.send({ code: -1, data: "获取失败" });
	}
});
//#endregion

const port = process.env.PORT || 80;
async function bootstrap() {
	await initUserDB();
	await initUser_data();
	await initShare_rewards();
	await initGameGridSave();
	
	// 初始化数据库清理系统
	const dbCleaner = new DatabaseCleaner(sequelize, {
		user_game_data,
		user_data,
		share_rewards
	});
	
	// 启动定时清理任务（每天凌晨2点执行）
	dbCleaner.startScheduledCleanup();
	
	// 添加清理状态查询接口
	app.get("/api/db_cleanup_status", async (req, res) => {
		try {
			const stats = dbCleaner.getStats();
			const tableSizes = await dbCleaner.checkTableSizes();
			
			res.send({ 
				code: 0, 
				data: { 
					stats, 
					tableSizes,
					serverPerformance: {
						memoryUsage: process.memoryUsage(),
						uptime: process.uptime()
					}
				} 
			});
		} catch (error) {
			console.error('获取清理状态错误:', error);
			res.send({ code: -1, data: "获取失败" });
		}
	});
	
	// 清理记录查询接口
	app.get("/api/db_cleanup_logs", async (req, res) => {
		try {
			const limit = parseInt(req.query.limit) || 20;
			const offset = parseInt(req.query.offset) || 0;
			
			const logs = dbCleaner.getCleanupLogs(limit, offset);
			
			res.send({ 
				code: 0, 
				data: logs
			});
		} catch (error) {
			console.error('获取清理记录错误:', error);
			res.send({ code: -1, data: "获取失败" });
		}
	});
	
	// 手动触发清理接口（需要权限验证）
	app.post("/api/manual_cleanup", async (req, res) => {
		try {
			// 简单的权限验证（实际生产环境应该更严格）
			if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
				return res.send({ code: -1, data: "权限不足" });
			}
			
			const cleaned = await dbCleaner.cleanupZombieUsers();
			const archived = await dbCleaner.archiveOldData();
			
			res.send({ 
				code: 0, 
				data: { 
					cleaned, 
					archived,
					message: `手动清理完成，删除 ${cleaned} 条数据，归档 ${archived} 个表`
				} 
			});
		} catch (error) {
			console.error('手动清理错误:', error);
			res.send({ code: -1, data: "清理失败" });
		}
	});
	
	app.listen(port, () => {
		console.log("启动成功", port);
		console.log("内存优化版本已启用 - 使用数据库查询替代内存存储");
		console.log("✅ 数据库自动清理系统已启动 - 每天凌晨2点执行");
	});
}

bootstrap();
