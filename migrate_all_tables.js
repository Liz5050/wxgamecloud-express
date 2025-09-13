const { sequelize } = require('./db');

async function migrateAllTables() {
    try {
        console.log('🔧 开始迁移所有数据库表，添加主键...\n');
        
        const tables = [
            'user_game_data',
            'share_rewards',
            'game_grid_save_data'
        ];
        
        for (const tableName of tables) {
            console.log(`📋 处理表: ${tableName}`);
            
            // 1. 检查当前表结构
            const tableInfo = await sequelize.query(
                `DESCRIBE ${tableName}`,
                { type: sequelize.QueryTypes.SELECT }
            );
            
            const hasIdColumn = tableInfo.some(col => col.Field === 'id');
            const hasPrimaryKey = tableInfo.some(col => col.Key === 'PRI');
            
            if (hasPrimaryKey) {
                console.log('✅ 表已有主键，跳过迁移');
                continue;
            }
            
            console.log('❌ 表缺少主键，开始迁移...');
            
            // 2. 备份现有数据
            const existingData = await sequelize.query(
                `SELECT * FROM ${tableName}`,
                { type: sequelize.QueryTypes.SELECT }
            );
            
            console.log(`📊 找到 ${existingData.length} 条记录需要迁移`);
            
            // 3. 创建临时表
            const tempTableName = `${tableName}_temp`;
            
            // 根据表结构动态生成创建语句
            const columns = tableInfo.map(col => {
                let columnDef = `${col.Field} ${col.Type}`;
                if (col.Null === 'NO') columnDef += ' NOT NULL';
                if (col.Default !== null) columnDef += ` DEFAULT '${col.Default}'`;
                return columnDef;
            }).join(',\n                ');
            
            await sequelize.query(`
                CREATE TABLE ${tempTableName} (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ${columns}
                )
            `);
            
            // 4. 迁移数据到临时表
            if (existingData.length > 0) {
                console.log('🔄 迁移数据到临时表...');
                
                const columnNames = tableInfo.map(col => col.Field).join(', ');
                const placeholders = tableInfo.map(() => '?').join(', ');
                
                for (const record of existingData) {
                    const values = tableInfo.map(col => record[col.Field]);
                    await sequelize.query(`
                        INSERT INTO ${tempTableName} (${columnNames})
                        VALUES (${placeholders})
                    `, { replacements: values });
                }
            }
            
            // 5. 删除原表
            await sequelize.query(`DROP TABLE ${tableName}`);
            
            // 6. 重命名临时表
            await sequelize.query(`RENAME TABLE ${tempTableName} TO ${tableName}`);
            
            console.log('✅ 迁移完成');
            console.log('---');
        }
        
        console.log('🎉 所有表迁移完成！');
        
    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        console.error('详细错误:', error);
        
        // 清理临时表
        try {
            const tables = ['user_game_data', 'share_rewards', 'game_grid_save_data'];
            for (const tableName of tables) {
                await sequelize.query(`DROP TABLE IF EXISTS ${tableName}_temp`);
            }
            console.log('✅ 已清理所有临时表');
        } catch (cleanupError) {
            console.error('清理临时表失败:', cleanupError.message);
        }
    } finally {
        await sequelize.close();
    }
}

// 提供简单的SQL语句供手动执行
function generateManualSQL() {
    console.log('\n📝 手动执行SQL语句（如果自动迁移失败）:');
    console.log('\n-- 为 user_game_data 表添加主键 --');
    console.log('ALTER TABLE user_game_data ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST;');
    
    console.log('\n-- 为 share_rewards 表添加主键 --');
    console.log('ALTER TABLE share_rewards ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST;');
    
    console.log('\n-- 为 game_grid_save_data 表添加主键 --');
    console.log('ALTER TABLE game_grid_save_data ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST;');
}

// 运行迁移
migrateAllTables().catch(console.error);

// 同时输出手动SQL
setTimeout(generateManualSQL, 100);