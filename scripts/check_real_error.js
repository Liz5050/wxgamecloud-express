const { sequelize, game_grid_save_data } = require('../src/models/index.js');

async function checkRealError() {
    try {
        console.log('🔍 检查实际错误场景...');
        
        // 1. 检查数据库连接
        console.log('1. 检查数据库连接状态...');
        await sequelize.authenticate();
        console.log('✅ 数据库连接正常');
        
        // 2. 检查模型定义
        console.log('2. 检查模型定义...');
        const attributes = game_grid_save_data.rawAttributes;
        const primaryKeys = Object.entries(attributes)
            .filter(([_, attr]) => attr.primaryKey)
            .map(([key, _]) => key);
        
        console.log('主键字段:', primaryKeys.length > 0 ? primaryKeys : '无');
        console.log('所有字段:', Object.keys(attributes));
        
        // 3. 检查表结构
        console.log('3. 检查表结构...');
        const tableInfo = await sequelize.query(
            "SHOW COLUMNS FROM game_grid_save_data",
            { type: sequelize.QueryTypes.SELECT }
        );
        
        const primaryKeyColumns = tableInfo.filter(col => col.Key === 'PRI');
        console.log('表主键列:', primaryKeyColumns.map(col => col.Field));
        
        // 4. 检查是否有记录缺少主键值
        console.log('4. 检查是否有记录缺少主键值...');
        const recordsWithoutPK = await sequelize.query(
            "SELECT COUNT(*) as count FROM game_grid_save_data WHERE id IS NULL",
            { type: sequelize.QueryTypes.SELECT }
        );
        
        console.log('缺少主键值的记录数:', recordsWithoutPK[0].count);
        
        // 5. 检查最近的操作记录
        console.log('5. 检查最近的操作记录...');
        const recentRecords = await game_grid_save_data.findAll({
            limit: 5,
            order: [['createdAt', 'DESC']]
        });
        
        console.log('最近5条记录:');
        recentRecords.forEach(record => {
            console.log(`  ID: ${record.id}, openid: ${record.openid}, createdAt: ${record.createdAt}`);
        });
        
        // 6. 模拟错误场景
        console.log('6. 模拟可能的错误场景...');
        
        // 场景1: 尝试创建一个没有主键的对象
        try {
            console.log('  场景1: 创建无主键对象...');
            const fakeItem = game_grid_save_data.build({});
            console.log('  创建的对象:', fakeItem);
            console.log('  是否有主键:', fakeItem.id !== undefined ? '有' : '无');
            
            // 尝试保存
            await fakeItem.save();
            console.log('  ✅ 保存成功（这不应该发生）');
        } catch (error) {
            console.log('  ❌ 预期错误:', error.message);
        }
        
    } catch (error) {
        console.error('❌ 检查失败:', error.message);
        console.error('详细错误:', error);
        
        if (error.original) {
            console.error('原始数据库错误:', error.original);
        }
    } finally {
        await sequelize.close();
    }
}

checkRealError().catch(console.error);