const path = require('path');
const fs = require('fs');

// 环境配置管理类
class EnvConfig {
    constructor() {
        this.env = process.env.NODE_ENV || 'development';
        this.configs = this.loadAllConfigs();
    }

    // 加载所有环境配置文件
    loadAllConfigs() {
        const configDir = path.join(__dirname, '..');
        const configs = {};
        
        // 支持的配置文件列表
        const envFiles = [
            '.env',           // 默认配置
            '.env.local',     // 本地开发配置
            '.env.test',      // 测试环境配置
            '.env.production' // 生产环境配置
        ];

        envFiles.forEach(file => {
            const filePath = path.join(configDir, file);
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const config = this.parseEnvContent(content);
                    configs[file] = config;
                    console.log(`✅ 加载配置文件: ${file}`);
                } catch (error) {
                    console.warn(`⚠️  无法加载配置文件 ${file}:`, error.message);
                }
            }
        });

        return configs;
    }

    // 解析.env文件内容
    parseEnvContent(content) {
        const config = {};
        const lines = content.split('\n');
        
        lines.forEach(line => {
            line = line.trim();
            // 跳过空行和注释
            if (!line || line.startsWith('#')) return;
            
            const [key, value] = line.split('=').map(part => part.trim());
            if (key && value !== undefined) {
                config[key] = value;
            }
        });

        return config;
    }

    // 获取当前环境的配置
    getCurrentConfig() {
        let config = {};
        
        // 按优先级合并配置
        if (this.configs['.env']) {
            Object.assign(config, this.configs['.env']);
        }
        
        if (this.env === 'test' && this.configs['.env.test']) {
            Object.assign(config, this.configs['.env.test']);
        } else if (this.env === 'production' && this.configs['.env.production']) {
            Object.assign(config, this.configs['.env.production']);
        } else if (this.configs['.env.local']) {
            Object.assign(config, this.configs['.env.local']);
        }
        
        // 最后用环境变量覆盖
        Object.assign(config, process.env);
        
        return config;
    }

    // 获取特定配置值
    get(key, defaultValue = undefined) {
        const config = this.getCurrentConfig();
        return config[key] || defaultValue;
    }

    // 打印当前配置（隐藏敏感信息）
    printConfig() {
        const config = this.getCurrentConfig();
        const safeConfig = { ...config };
        
        // 隐藏敏感信息
        if (safeConfig.MYSQL_PASSWORD) {
            safeConfig.MYSQL_PASSWORD = '***';
        }
        if (safeConfig.ADMIN_TOKEN) {
            safeConfig.ADMIN_TOKEN = '***';
        }
        
        console.log('📋 当前环境配置:');
        console.log(`   环境: ${this.env}`);
        Object.entries(safeConfig).forEach(([key, value]) => {
            console.log(`   ${key}=${value}`);
        });
    }
}

// 创建单例实例
const envConfig = new EnvConfig();

// 导出常用方法
module.exports = {
    config: envConfig,
    get: envConfig.get.bind(envConfig),
    printConfig: envConfig.printConfig.bind(envConfig),
    getCurrentConfig: envConfig.getCurrentConfig.bind(envConfig)
};