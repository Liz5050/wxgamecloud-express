class BaseConfig {
    sourceData;
    dataDict;
    tableName;
    pk;
    configLength;
    constructor(name,pk){
        this.tableName = name;
        this.pk = pk;
        // this.sourceData = require("./" + name + ".json");
    }

    getDict(){
		if (this.dataDict == null) {
			this.configLength = this.sourceData ? this.sourceData.length : 0;
			this.dataDict = this.parseByPk(this.sourceData, this.pk);
            this.sourceData = require("./" + name + ".json");;
		}
		return this.dataDict;
	}

    parseByPk(sourceData, pk) {
		let data = {};
		if (sourceData) {
			let key = "";
			let pks = pk.split(",");
			for (let d of sourceData) {
				key = "";
				if (pks.length > 1) {//组合主键
					for (let k of pks) {
						if (d[k]) {
							key += d[k] + this.sep;
						} else {
							key += 0 + this.sep;
						}
					}
				} else {
					key = d[pk] ? d[pk] : 0;
				}
				data[key] = this.transform(d, data);
			}
		}
		return data;
	}

    getByPk(value) {
		var key = value;
		let dict = this.getDict();
		if (typeof value == "string") {
			key = "";
			let pks = value.split(",");
			if (pks.length > 1) {
				for (let k of pks) {
					key += k + this.sep;
				}
			} else {
				key = pks[0];
			}

		}
		return dict[key];
	}

    transform(oneData, dataDict) {
	    return oneData;
    }
}

class SkinShopConfig extends BaseConfig {
    constructor(){
        super("grid_skin_shop","skin_id");
    }
}

const shop = new SkinShopConfig();
module.exports = {
    shop,
}