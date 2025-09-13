// 云端调试API调用示例 - 数据库清理系统
// 适用于微信云开发 callContainer 调用

// 1. 获取清理状态（无需权限）
const getCleanupStatus = {
  "config": {
    "env": "prod-2gue9n1kd74122cb" // 替换为您的环境ID
  },
  "path": "/api/db_cleanup_status",
  "header": {
    "X-WX-SERVICE": "express-589u",      // 替换为您的服务名
    "content-type": "application/json"
  },
  "method": "GET",
  "data": ""
};

// 2. 查看清理记录（无需权限）
const getCleanupLogs = {
  "config": {
    "env": "prod-2gue9n1kd74122cb"
  },
  "path": "/api/db_cleanup_logs?limit=20&offset=0", // 支持分页参数
  "header": {
    "X-WX-SERVICE": "express-589u",
    "content-type": "application/json"
  },
  "method": "GET",
  "data": ""
};

// 3. 手动执行清理（需要管理员权限）
const manualCleanup = {
  "config": {
    "env": "prod-2gue9n1kd74122cb"
  },
  "path": "/api/manual_cleanup",
  "header": {
    "X-WX-SERVICE": "express-589u",
    "content-type": "application/json",
    "x-admin-token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" // 必须设置，使用您指定的UUID token
  },
  "method": "POST",
  "data": "" // POST请求体为空
};

// 4. 带参数查看清理记录
const getCleanupLogsWithParams = {
  "config": {
    "env": "prod-2gue9n1kd74122cb"
  },
  "path": "/api/db_cleanup_logs?limit=50&offset=10", // 查看第2页，每页50条
  "header": {
    "X-WX-SERVICE": "express-589u",
    "content-type": "application/json"
  },
  "method": "GET",
  "data": ""
};

// 使用示例（在云函数或小程序中调用）
/*
wx.cloud.callContainer(getCleanupStatus)
  .then(res => {
    console.log('清理状态:', res);
  })
  .catch(console.error);

wx.cloud.callContainer(manualCleanup)
  .then(res => {
    console.log('手动清理结果:', res);
  })
  .catch(console.error);
*/

// 响应格式说明
/*
清理状态响应 (GET /api/db_cleanup_status):
{
  code: 0,
  data: {
    stats: {
      lastRun: "2024-01-01T00:00:00.000Z",
      totalCleaned: 1000,
      lastCleaned: 50,
      errors: 0
    },
    tableSizes: {
      user_game_data: { current: 15000, max: 50000, exceeded: false, percentage: "30.0" },
      user_data: { current: 5000, max: 20000, exceeded: false, percentage: "25.0" }
    }
  }
}

手动清理响应 (POST /api/manual_cleanup):
{
  code: 0,
  data: {
    cleaned: 50,        // 删除的数据条数
    archived: 0,        // 归档的数据条数
    message: "手动清理完成，删除 50 条数据，归档 0 个表"
  }
}

清理记录响应 (GET /api/db_cleanup_logs):
{
  code: 0,
  data: {
    logs: [
      {
        timestamp: "2024-01-01T02:00:00.000Z",
        operation: "zombie_cleanup_summary",
        zombieUsersCount: 10,
        totalDeleted: 50
      }
    ],
    total: 100,     // 总记录数
    hasMore: true   // 是否有更多记录
  }
}
*/

module.exports = {
  getCleanupStatus,
  getCleanupLogs,
  manualCleanup,
  getCleanupLogsWithParams
};