const { sequelize, user_data } = require('../src/models/index.js');

async function diagnoseDatabase() {
    try {
        console.log('🔍 开始数据库诊断...');
        
        // 1. 检查数据库连接
        console.log('1. 测试数据库连接...');
        await sequelize.authenticate();
        console.log('✅ 数据库连接正常');
        
        // 2. 检查user_data表结构
        console.log('2. 检查user_data表结构...');
        const tableInfo = await sequelize.query(
            "DESCRIBE user_data", 
            { type: sequelize.QueryTypes.SELECT }
        );
        console.log('✅ user_data表结构:', tableInfo.map(col => col.Field).join(', '));
        
        // 3. 检查表记录数量
        console.log('3. 检查user_data表记录数量...');
        const count = await user_data.count();
        console.log(`✅ user_data表当前记录数: ${count}`);
        
        // 4. 尝试创建一个测试记录
        console.log('4. 测试创建新记录...');
        const testOpenId = 'test_diagnose_' + Date.now();
        const testRecord = await user_data.create({
            openid: testOpenId,
            nick_name: '测试用户',
            avatar_url: '',
            score: 100,
            skin_id: 0,
            skin_list: ''
        });
        console.log('✅ 测试记录创建成功:', testRecord.id);
        
        // 5. 尝试更新记录
        console.log('5. 测试更新记录...');
        testRecord.score = 200;
        await testRecord.save();
        console.log('✅ 记录更新成功');
        
        // 6. 清理测试记录
        console.log('6. 清理测试记录...');
        await testRecord.destroy();
        console.log('✅ 测试记录清理完成');
        
        console.log('🎉 数据库诊断完成，所有测试通过！');
        
    } catch (error) {
        console.error('❌ 数据库诊断失败:', error.message);
        console.error('详细错误信息:', error);
        
        if (error.original) {
            console.error('原始数据库错误:', error.original);
        }
    } finally {
        await sequelize.close();
    }
}

// 运行诊断
diagnoseDatabase().catch(console.error);