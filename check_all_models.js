const { sequelize, user_data, user_game_data, share_rewards } = require('./db');
const { game_grid_save_data } = require('./module/gameGrid/GameGridSaveDB');

async function checkAllModels() {
    try {
        console.log('🔍 检查所有数据库模型的主键状态...\n');
        
        const models = [
            { name: 'user_data', model: user_data },
            { name: 'user_game_data', model: user_game_data },
            { name: 'share_rewards', model: share_rewards },
            { name: 'game_grid_save_data', model: game_grid_save_data }
        ];
        
        let allGood = true;
        
        for (const { name, model } of models) {
            console.log(`📊 检查模型: ${name}`);
            
            // 检查模型定义
            const tableName = model.tableName;
            const attributes = model.rawAttributes;
            
            // 查找主键
            const primaryKeys = Object.entries(attributes)
                .filter(([_, attr]) => attr.primaryKey)
                .map(([key, _]) => key);
            
            if (primaryKeys.length > 0) {
                console.log(`✅ 模型定义: 有主键 (${primaryKeys.join(', ')})`);
            } else {
                console.log('❌ 模型定义: 缺少主键');
                allGood = false;
            }
            
            // 检查数据库表结构
            try {
                const tableInfo = await sequelize.query(
                    `DESCRIBE ${tableName}`,
                    { type: sequelize.QueryTypes.SELECT }
                );
                
                const dbPrimaryKeys = tableInfo.filter(col => col.Key === 'PRI');
                
                if (dbPrimaryKeys.length > 0) {
                    console.log(`✅ 数据库表: 有主键 (${dbPrimaryKeys.map(col => col.Field).join(', ')})`);
                } else {
                    console.log('❌ 数据库表: 缺少主键');
                    allGood = false;
                }
                
                // 检查记录数量
                const countResult = await sequelize.query(
                    `SELECT COUNT(*) as count FROM ${tableName}`,
                    { type: sequelize.QueryTypes.SELECT }
                );
                console.log(`📈 记录数量: ${countResult[0].count}`);
                
            } catch (error) {
                console.log('❓ 数据库表: 可能不存在或无法访问');
                allGood = false;
            }
            
            console.log('---');
        }
        
        if (allGood) {
            console.log('🎉 所有模型都有正确的主键配置！');
        } else {
            console.log('⚠️  发现一些问题，需要运行迁移脚本修复数据库表结构');
            console.log('运行: node migrate_all_tables.js');
        }
        
    } catch (error) {
        console.error('检查失败:', error.message);
    } finally {
        await sequelize.close();
    }
}

checkAllModels().catch(console.error);