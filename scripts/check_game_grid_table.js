const { sequelize } = require('../src/models/index.js');

async function checkGameGridTable() {
    try {
        console.log('🔍 检查 game_grid_save_data 表状态...');
        
        // 检查表结构
        const tableInfo = await sequelize.query(
            "DESCRIBE game_grid_save_data", 
            { type: sequelize.QueryTypes.SELECT }
        );
        
        console.log('📊 表结构:');
        tableInfo.forEach(col => {
            console.log(`  ${col.Field}: ${col.Type} ${col.Key || ''} ${col.Extra || ''}`);
        });
        
        // 检查是否有主键
        const hasPrimaryKey = tableInfo.some(col => col.Key === 'PRI');
        console.log(`\n🔑 主键状态: ${hasPrimaryKey ? '✅ 有主键' : '❌ 无主键'}`);
        
        if (!hasPrimaryKey) {
            console.log('\n🚨 问题: 表缺少主键，这会导致 Sequelize 保存操作失败！');
            console.log('💡 解决方案: 运行迁移脚本添加主键');
            console.log('   node migrate_all_tables.js');
            
            // 提供手动修复SQL
            console.log('\n📝 手动修复SQL:');
            console.log('   ALTER TABLE game_grid_save_data ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST;');
        }
        
        // 检查记录数量
        const countResult = await sequelize.query(
            "SELECT COUNT(*) as count FROM game_grid_save_data", 
            { type: sequelize.QueryTypes.SELECT }
        );
        console.log(`\n📈 记录数量: ${countResult[0].count}`);
        
    } catch (error) {
        console.error('❌ 检查失败:', error.message);
        if (error.original) {
            console.error('数据库错误:', error.original);
        }
        
        // 如果表不存在
        if (error.original && error.original.code === 'ER_NO_SUCH_TABLE') {
            console.log('\n💡 表不存在，需要重新创建表结构');
            console.log('   运行: node -e "require(\'../src/models/GameGridSaveDB.js\').initGameGridSave()"');
        }
    } finally {
        await sequelize.close();
    }
}

checkGameGridTable().catch(console.error);