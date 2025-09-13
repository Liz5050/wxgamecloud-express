const { sequelize } = require('./db');
const { game_grid_save_data } = require('./module/gameGrid/GameGridSaveDB');

async function debugSaveError() {
    try {
        console.log('🔍 调试保存错误...');
        
        // 模拟一个测试openid
        const testOpenId = 'test_debug_' + Date.now();
        
        // 1. 尝试创建一个新记录
        console.log('1. 尝试创建新记录...');
        const newItem = await game_grid_save_data.create({
            openid: testOpenId,
            data_str: 'test_data',
            is_valid: 1
        });
        
        console.log('✅ 创建成功:', newItem.id);
        
        // 2. 尝试查询这个记录
        console.log('2. 尝试查询记录...');
        const foundItem = await game_grid_save_data.findOne({
            where: { openid: testOpenId }
        });
        
        if (foundItem) {
            console.log('✅ 查询成功:', foundItem.id);
            
            // 3. 尝试修改并保存
            console.log('3. 尝试修改并保存...');
            foundItem.data_str = 'updated_data';
            foundItem.is_valid = 0;
            
            await foundItem.save();
            console.log('✅ 保存成功');
            
            // 4. 清理测试数据
            console.log('4. 清理测试数据...');
            await foundItem.destroy();
            console.log('✅ 清理完成');
            
        } else {
            console.log('❌ 查询失败');
        }
        
    } catch (error) {
        console.error('❌ 调试失败:', error.message);
        console.error('详细错误:', error);
        
        if (error.original) {
            console.error('原始数据库错误:', error.original);
        }
        
        // 检查错误是否与主键相关
        if (error.message.includes('primary key') || error.message.includes('no primary key')) {
            console.log('\n🔍 主键相关错误检测到！');
            
            // 检查模型定义
            const attributes = game_grid_save_data.rawAttributes;
            const primaryKeys = Object.entries(attributes)
                .filter(([_, attr]) => attr.primaryKey)
                .map(([key, _]) => key);
            
            console.log('模型主键字段:', primaryKeys.length > 0 ? primaryKeys : '无');
        }
    } finally {
        await sequelize.close();
    }
}

debugSaveError().catch(console.error);