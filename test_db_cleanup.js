// 测试数据库清理功能
const { sequelize, user_game_data, user_data, share_rewards } = require('./src/models/index');
const DatabaseCleaner = require('./src/services/DatabaseCleaner');

async function testDatabaseCleanup() {
    console.log('开始测试数据库清理功能...');
    
    try {
        // 创建DatabaseCleaner实例
        const dbCleaner = new DatabaseCleaner(sequelize, {
            user_game_data,
            user_data,
            share_rewards
        });
        
        // 手动调用清理方法
        console.log('\n手动调用cleanupUserDataTable方法:');
        const result = await dbCleaner.cleanupUserDataTable();
        console.log(`清理结果: 删除了 ${result} 条记录`);
        
        // 检查表大小
        console.log('\n检查表大小:');
        const tableSizes = await dbCleaner.checkTableSizes();
        console.log('表大小信息:', tableSizes);
        
        // 检查清理统计信息
        console.log('\n清理统计信息:');
        const stats = dbCleaner.getStats();
        console.log('统计信息:', stats);
        
    } catch (error) {
        console.error('测试过程中发生错误:', error);
    } finally {
        // 关闭数据库连接
        await sequelize.close();
        console.log('\n测试完成，数据库连接已关闭');
    }
}

// 执行测试
testDatabaseCleanup();
