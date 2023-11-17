const { DataTypes } = require("sequelize");
const {sequelize} = require("../../db.js");
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
	await game_grid_save_data.sync();
}
module.exports = {
	initGameGridSave,
	game_grid_save_data
}