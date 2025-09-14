const { sequelize, user_data } = require('./db');

async function testSkinFunction() {
    try {
        console.log('🔍 测试使用皮肤功能...');
        
        // 1. 创建一个测试用户
        const testOpenId = 'test_skin_' + Date.now();
        
        console.log('1. 创建测试用户...');
        const testUser = await user_data.create({
            openid: testOpenId,
            nick_name: '测试用户',
            avatar_url: '',
            score: 0,
            skin_id: 0,
            skin_list: '1,2,3' // 用户拥有皮肤1,2,3
        });
        
        console.log('✅ 用户创建成功，ID:', testUser.id);
        
        // 2. 测试查询用户数据
        console.log('2. 查询用户数据...');
        const foundUser = await user_data.findOne({
            where: { openid: testOpenId }
            // 注意：必须包含主键字段id，否则无法保存
        });
        
        if (foundUser) {
            console.log('✅ 查询成功:', {
                id: foundUser.id,
                openid: foundUser.openid,
                skin_id: foundUser.skin_id,
                skin_list: foundUser.skin_list
            });
            
            // 3. 测试使用皮肤功能
            console.log('3. 测试使用皮肤功能...');
            
            // 检查用户是否拥有皮肤2
            const skinList = foundUser.skin_list ? foundUser.skin_list.split(",") : [];
            if (skinList.includes("2")) {
                console.log('✅ 用户拥有皮肤2');
                
                // 尝试修改皮肤
                foundUser.skin_id = 2;
                
                console.log('4. 尝试保存皮肤设置...');
                await foundUser.save();
                console.log('✅ 皮肤设置保存成功');
                
                // 验证保存结果
                console.log('5. 验证保存结果...');
                const updatedUser = await user_data.findOne({
                    where: { openid: testOpenId }
                });
                
                console.log('✅ 验证成功 - 当前皮肤ID:', updatedUser.skin_id);
                
            } else {
                console.log('❌ 用户不拥有皮肤2');
            }
            
        } else {
            console.log('❌ 用户查询失败');
        }
        
        // 6. 清理测试数据
        console.log('6. 清理测试数据...');
        await user_data.destroy({ where: { openid: testOpenId } });
        console.log('✅ 清理完成');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('详细错误:', error);
        
        if (error.original) {
            console.error('原始数据库错误:', error.original);
        }
        
        // 检查是否是主键错误
        if (error.message.includes('primary key') || error.message.includes('no primary key')) {
            console.log('\n🔍 检测到主键相关错误！');
            
            // 检查模型定义
            const attributes = user_data.rawAttributes;
            const primaryKeys = Object.entries(attributes)
                .filter(([_, attr]) => attr.primaryKey)
                .map(([key, _]) => key);
            
            console.log('user_data模型主键字段:', primaryKeys.length > 0 ? primaryKeys : '无');
        }
    } finally {
        await sequelize.close();
    }
}

testSkinFunction().catch(console.error);