/**
 * 接口文档数据（自动生成，请勿手工编辑）。
 *
 * 由 `scripts/gen-api-docs.mjs` 在构建期扫描控制器产出；修改接口后请重新执行
 * `npm run docs:gen`（`npm run build` 的 prebuild 已自动接入）。
 */
import type { ApiDocGroup } from './docs.types.js';

export const API_DOCS: ApiDocGroup[] = [
  {
    "group": "仪表盘",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/dashboard/login-trend",
        "summary": "登录趋势",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "days",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "",
            "example": 7
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/dashboard/login-trend?days=7\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "days": 7
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/dashboard/operation-distribution",
        "summary": "操作类型分布",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/dashboard/operation-distribution?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/dashboard/role-user-count",
        "summary": "各角色用户数",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/dashboard/role-user-count?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/dashboard/stats",
        "summary": "统计卡片",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/dashboard/stats?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      }
    ]
  },
  {
    "group": "认证",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/auth/captcha",
        "summary": "图形验证码：公开接口（登录前获取）",
        "permission": [],
        "isPublic": true,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/auth/captcha?page=1&pageSize=10\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/auth/menus",
        "summary": "当前用户菜单树（仅目录/菜单节点，按角色 + 用户级额外权限覆盖过滤）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/auth/menus?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/auth/permissions",
        "summary": "当前用户权限码列表",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/auth/permissions?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/auth/profile",
        "summary": "当前用户信息",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/auth/profile?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/auth/login",
        "summary": "登录。 挂载频率限制：连续失败 5 次 / 5 分钟 → 锁定 15 分钟（返回 429）",
        "permission": [],
        "isPublic": true,
        "action": "认证 · 登录",
        "params": [
          {
            "name": "username",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "登录账号",
            "example": "admin"
          },
          {
            "name": "password",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "明文密码",
            "example": "123456"
          },
          {
            "name": "captchaId",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "验证码 id（验证码启用时必填，由前端从 /auth/captcha 获取）",
            "example": "b7f3c1a2-0000-4a1b-9c3d-8e6f5a4b3c2d"
          },
          {
            "name": "captchaCode",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "用户输入的验证码",
            "example": "A1B2"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/auth/login\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"username\": \"admin\",\n      \"password\": \"123456\",\n      \"captchaId\": \"b7f3c1a2-0000-4a1b-9c3d-8e6f5a4b3c2d\",\n      \"captchaCode\": \"A1B2\"\n    }'",
          "requestBody": {
            "username": "admin",
            "password": "123456",
            "captchaId": "b7f3c1a2-0000-4a1b-9c3d-8e6f5a4b3c2d",
            "captchaCode": "A1B2"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/auth/logout",
        "summary": "登出",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/auth/logout\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/auth/refresh",
        "summary": "刷新 Token",
        "permission": [],
        "isPublic": true,
        "action": "",
        "params": [
          {
            "name": "refreshToken",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "刷新令牌（refreshToken）",
            "example": "<登录返回的 refreshToken>"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/auth/refresh\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"refreshToken\": \"<登录返回的 refreshToken>\"\n    }'",
          "requestBody": {
            "refreshToken": "<登录返回的 refreshToken>"
          }
        }
      }
    ]
  },
  {
    "group": "用户管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/users",
        "summary": "分页列表（含数据权限过滤）",
        "permission": [
          "system:user:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "username",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "deptId",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/users?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/users/:id",
        "summary": "用户详情",
        "permission": [
          "system:user:query"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/users/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/users/:id/menus",
        "summary": "用户的菜单权限概况：角色自带 / 额外授予 / 额外撤销 / 最终有效。 用于「额外权限」抽屉回填：最终有效用于勾选，角色自带用于标注来源",
        "permission": [
          "system:user:assignPerm"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/users/1/menus\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/users/import/template",
        "summary": "下载 CSV 导入模板。 必须声明在 `@Get(':id')` **之前**：Nest 按声明顺序匹配，否则 `import/template` 会被 `:id` 吃掉",
        "permission": [
          "system:user:add"
        ],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/users/import/template\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "isRawResponse": true
        }
      },
      {
        "method": "POST",
        "path": "/api/users",
        "summary": "新增用户",
        "permission": [
          "system:user:add"
        ],
        "isPublic": false,
        "action": "用户管理 · 新增",
        "params": [
          {
            "name": "username",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "登录账号：3~20 位字母/数字/下划线",
            "example": "admin"
          },
          {
            "name": "password",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "明文密码：长度与复杂度统一由 common/auth/password-policy.ts 决定",
            "example": "123456"
          },
          {
            "name": "nickname",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "昵称",
            "example": "示例用户"
          },
          {
            "name": "email",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "邮箱（可空）",
            "example": "demo@example.com"
          },
          {
            "name": "phone",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "手机号（可空）",
            "example": "13800138000"
          },
          {
            "name": "gender",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "性别（字典 sys_user_sex 的值，可空）",
            "example": "1"
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "状态：1 启用 / 0 禁用，默认 1",
            "example": 1
          },
          {
            "name": "roleIds",
            "in": "body",
            "type": "number[]",
            "required": false,
            "description": "角色 id 列表，默认空",
            "example": [
              1
            ]
          },
          {
            "name": "deptId",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "部门 id（0 表示未分配），默认 0",
            "example": 1
          },
          {
            "name": "remark",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "备注（可空）",
            "example": "示例备注"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/users\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"username\": \"admin\",\n      \"password\": \"123456\",\n      \"nickname\": \"示例用户\",\n      \"email\": \"demo@example.com\",\n      \"phone\": \"13800138000\",\n      \"gender\": \"1\",\n      \"status\": 1,\n      \"roleIds\": [\n        1\n      ],\n      \"deptId\": 1,\n      \"remark\": \"示例备注\"\n    }'",
          "requestBody": {
            "username": "admin",
            "password": "123456",
            "nickname": "示例用户",
            "email": "demo@example.com",
            "phone": "13800138000",
            "gender": "1",
            "status": 1,
            "roleIds": [
              1
            ],
            "deptId": 1,
            "remark": "示例备注"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/users/import",
        "summary": "批量导入用户（CSV，全成功或全不写）。 行级校验失败返回 200 + 逐行报告（`data.failed`），请求级问题（空文件/缺列/超行数）才是 400",
        "permission": [
          "system:user:add"
        ],
        "isPublic": false,
        "action": "用户管理 · 批量导入",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/users/import\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "PUT",
        "path": "/api/users/:id",
        "summary": "编辑用户",
        "permission": [
          "system:user:edit"
        ],
        "isPublic": false,
        "action": "用户管理 · 编辑",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "nickname",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "昵称",
            "example": "示例用户"
          },
          {
            "name": "email",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "邮箱（可空）",
            "example": "demo@example.com"
          },
          {
            "name": "phone",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "手机号（可空）",
            "example": "13800138000"
          },
          {
            "name": "gender",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "性别（可空）",
            "example": "1"
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "状态：1 启用 / 0 禁用，默认 1",
            "example": 1
          },
          {
            "name": "roleIds",
            "in": "body",
            "type": "number[]",
            "required": false,
            "description": "角色 id 列表，默认空",
            "example": [
              1
            ]
          },
          {
            "name": "deptId",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "部门 id（0 表示未分配），默认 0",
            "example": 1
          },
          {
            "name": "remark",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "备注（可空）",
            "example": "示例备注"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/users/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"nickname\": \"示例用户\",\n      \"email\": \"demo@example.com\",\n      \"phone\": \"13800138000\",\n      \"gender\": \"1\",\n      \"status\": 1,\n      \"roleIds\": [\n        1\n      ],\n      \"deptId\": 1,\n      \"remark\": \"示例备注\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "nickname": "示例用户",
            "email": "demo@example.com",
            "phone": "13800138000",
            "gender": "1",
            "status": 1,
            "roleIds": [
              1
            ],
            "deptId": 1,
            "remark": "示例备注"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/users/:id/menus",
        "summary": "保存用户的额外菜单权限。 入参为「期望的最终有效菜单集合」，服务端与角色自带集合求差得出额外授予 / 额外撤销",
        "permission": [
          "system:user:assignPerm"
        ],
        "isPublic": false,
        "action": "用户管理 · 额外权限",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "menuIds",
            "in": "body",
            "type": "number[]",
            "required": false,
            "description": "",
            "example": [
              1
            ]
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/users/1/menus\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"menuIds\": [\n        1\n      ]\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "menuIds": [
              1
            ]
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/users/:id/password",
        "summary": "重置密码",
        "permission": [
          "system:user:resetPwd"
        ],
        "isPublic": false,
        "action": "用户管理 · 重置密码",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "password",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "123456"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/users/1/password\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"password\": \"123456\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "password": "123456"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/users/:id/roles",
        "summary": "分配角色",
        "permission": [
          "system:user:assignRole"
        ],
        "isPublic": false,
        "action": "用户管理 · 分配角色",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "roleIds",
            "in": "body",
            "type": "number[]",
            "required": false,
            "description": "",
            "example": [
              1
            ]
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/users/1/roles\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"roleIds\": [\n        1\n      ]\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "roleIds": [
              1
            ]
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/users/:id/status",
        "summary": "启用/禁用",
        "permission": [
          "system:user:edit"
        ],
        "isPublic": false,
        "action": "用户管理 · 状态变更",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/users/1/status\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"status\": 1\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "status": 1
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/users",
        "summary": "批量删除用户。 复用单条删除的权限码（这是同一个能力，不该再拆一个权限出来）； 返回明细而非「全成功/全失败」：批量里被超管保护或自身账号挡下的条目要能说清原因",
        "permission": [
          "system:user:remove"
        ],
        "isPublic": false,
        "action": "用户管理 · 批量删除",
        "params": [
          {
            "name": "ids",
            "in": "body",
            "type": "number[]",
            "required": true,
            "description": "",
            "example": []
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/users\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"ids\": []\n    }'",
          "requestBody": {
            "ids": []
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/users/:id",
        "summary": "删除用户",
        "permission": [
          "system:user:remove"
        ],
        "isPublic": false,
        "action": "用户管理 · 删除",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/users/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "角色管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/roles",
        "summary": "角色分页列表",
        "permission": [
          "system:role:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "roleName",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/roles?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/roles/:id/menus",
        "summary": "角色已授权菜单 id",
        "permission": [
          "system:role:query"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/roles/1/menus\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/roles/all",
        "summary": "全部角色下拉。 使用独立权限码 system:role:all，而非复用只读的 system:role:list： admin 角色刻意不授予 system:role:list，而本接口是给持 system:user:assignRole 的角色 拉取「分配角色」下拉框用的；复用 system:role:list 会把该能力收死，故新开独立码",
        "permission": [
          "system:role:all"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/roles/all?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/roles",
        "summary": "新增角色",
        "permission": [
          "system:role:add"
        ],
        "isPublic": false,
        "action": "角色管理 · 新增",
        "params": [
          {
            "name": "roleName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例角色"
          },
          {
            "name": "roleCode",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "demo_role"
          },
          {
            "name": "sort",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "dataScope",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人",
            "example": 1
          },
          {
            "name": "deptIds",
            "in": "body",
            "type": "number[]",
            "required": false,
            "description": "自定义部门 id 列表（dataScope=2 时生效）",
            "example": [
              1
            ]
          },
          {
            "name": "remark",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例备注"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/roles\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"roleName\": \"示例角色\",\n      \"roleCode\": \"demo_role\",\n      \"sort\": 1,\n      \"status\": 1,\n      \"dataScope\": 1,\n      \"deptIds\": [\n        1\n      ],\n      \"remark\": \"示例备注\"\n    }'",
          "requestBody": {
            "roleName": "示例角色",
            "roleCode": "demo_role",
            "sort": 1,
            "status": 1,
            "dataScope": 1,
            "deptIds": [
              1
            ],
            "remark": "示例备注"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/roles/reset-menus",
        "summary": "按种子定义恢复角色的默认菜单授权（「恢复默认授权」）。 为什么需要它：启动种子只负责**首次创建**角色并写授权，不再每次重启都覆盖 （那会把运维调好的授权静默回滚）；所以\"想回到种子默认\"必须由运维显式触发。 权限码复用 `system:role:assignMenu`：这与「授权菜单」是同一种能力（写角色菜单授权）， 只是数据来源换成种子定义；按项目「同一能力不拆权限码」的约定不新增码",
        "permission": [
          "system:role:assignMenu"
        ],
        "isPublic": false,
        "action": "角色管理 · 恢复默认授权",
        "params": [
          {
            "name": "roleIds",
            "in": "body",
            "type": "number[]",
            "required": false,
            "description": "目标角色 id；不传 / 传空数组 = 全部种子角色",
            "example": [
              1
            ]
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/roles/reset-menus\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"roleIds\": [\n        1\n      ]\n    }'",
          "requestBody": {
            "roleIds": [
              1
            ]
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/roles/:id",
        "summary": "编辑角色",
        "permission": [
          "system:role:edit"
        ],
        "isPublic": false,
        "action": "角色管理 · 编辑",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "roleName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例角色"
          },
          {
            "name": "sort",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "dataScope",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人",
            "example": 1
          },
          {
            "name": "deptIds",
            "in": "body",
            "type": "number[]",
            "required": false,
            "description": "自定义部门 id 列表（dataScope=2 时生效）",
            "example": [
              1
            ]
          },
          {
            "name": "remark",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例备注"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/roles/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"roleName\": \"示例角色\",\n      \"sort\": 1,\n      \"status\": 1,\n      \"dataScope\": 1,\n      \"deptIds\": [\n        1\n      ],\n      \"remark\": \"示例备注\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "roleName": "示例角色",
            "sort": 1,
            "status": 1,
            "dataScope": 1,
            "deptIds": [
              1
            ],
            "remark": "示例备注"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/roles/:id/menus",
        "summary": "授权角色菜单",
        "permission": [
          "system:role:assignMenu"
        ],
        "isPublic": false,
        "action": "角色管理 · 授权菜单",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "menuIds",
            "in": "body",
            "type": "number[]",
            "required": false,
            "description": "",
            "example": [
              1
            ]
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/roles/1/menus\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"menuIds\": [\n        1\n      ]\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "menuIds": [
              1
            ]
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/roles",
        "summary": "批量删除角色（复用单条删除的权限码；逐条执行并返回被跳过明细）",
        "permission": [
          "system:role:remove"
        ],
        "isPublic": false,
        "action": "角色管理 · 批量删除",
        "params": [
          {
            "name": "ids",
            "in": "body",
            "type": "number[]",
            "required": true,
            "description": "",
            "example": []
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/roles\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"ids\": []\n    }'",
          "requestBody": {
            "ids": []
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/roles/:id",
        "summary": "删除角色",
        "permission": [
          "system:role:remove"
        ],
        "isPublic": false,
        "action": "角色管理 · 删除",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/roles/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "菜单管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/menus",
        "summary": "菜单列表（tree=1 返回树）",
        "permission": [
          "system:menu:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "menuName",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "tree",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/menus?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/menus/:id",
        "summary": "菜单详情",
        "permission": [
          "system:menu:query"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/menus/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/menus/tree",
        "summary": "全量菜单树（含按钮，供角色授权）",
        "permission": [
          "system:menu:list",
          "system:role:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/menus/tree?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/menus",
        "summary": "创建菜单",
        "permission": [
          "system:menu:add"
        ],
        "isPublic": false,
        "action": "菜单管理 · 新增",
        "params": [
          {
            "name": "parentId",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "menuName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例菜单"
          },
          {
            "name": "menuType",
            "in": "body",
            "type": "'M' | 'C' | 'F'",
            "required": true,
            "description": "",
            "example": "C"
          },
          {
            "name": "path",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "component",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "icon",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "permission",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "sort",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "visible",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "redirect",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "keepAlive",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/menus\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"parentId\": 1,\n      \"menuName\": \"示例菜单\",\n      \"menuType\": \"C\",\n      \"path\": \"示例值\",\n      \"component\": \"示例值\",\n      \"icon\": \"示例值\",\n      \"permission\": \"示例值\",\n      \"sort\": 1,\n      \"visible\": 1,\n      \"status\": 1,\n      \"redirect\": \"示例值\",\n      \"keepAlive\": 1\n    }'",
          "requestBody": {
            "parentId": 1,
            "menuName": "示例菜单",
            "menuType": "C",
            "path": "示例值",
            "component": "示例值",
            "icon": "示例值",
            "permission": "示例值",
            "sort": 1,
            "visible": 1,
            "status": 1,
            "redirect": "示例值",
            "keepAlive": 1
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/menus/:id",
        "summary": "更新菜单",
        "permission": [
          "system:menu:edit"
        ],
        "isPublic": false,
        "action": "菜单管理 · 编辑",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "parentId",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "menuName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例菜单"
          },
          {
            "name": "menuType",
            "in": "body",
            "type": "'M' | 'C' | 'F'",
            "required": true,
            "description": "",
            "example": "C"
          },
          {
            "name": "path",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "component",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "icon",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "permission",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "sort",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "visible",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "redirect",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "keepAlive",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/menus/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"parentId\": 1,\n      \"menuName\": \"示例菜单\",\n      \"menuType\": \"C\",\n      \"path\": \"示例值\",\n      \"component\": \"示例值\",\n      \"icon\": \"示例值\",\n      \"permission\": \"示例值\",\n      \"sort\": 1,\n      \"visible\": 1,\n      \"status\": 1,\n      \"redirect\": \"示例值\",\n      \"keepAlive\": 1\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "parentId": 1,
            "menuName": "示例菜单",
            "menuType": "C",
            "path": "示例值",
            "component": "示例值",
            "icon": "示例值",
            "permission": "示例值",
            "sort": 1,
            "visible": 1,
            "status": 1,
            "redirect": "示例值",
            "keepAlive": 1
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/menus/:id",
        "summary": "删除菜单",
        "permission": [
          "system:menu:remove"
        ],
        "isPublic": false,
        "action": "菜单管理 · 删除",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/menus/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "字典管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/dict/data/:dictType",
        "summary": "按类型编码取启用中的字典项（标签 + 值）。 仅需登录、不设权限码（与 /api/profile 的「自有资源豁免」同类处理）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "dictType",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "sys_demo"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/dict/data/sys_demo\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "dictType": "sys_demo"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/dict/items",
        "summary": "字典项分页列表（按 dictType 过滤）",
        "permission": [
          "system:dict:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "dictType",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "dictLabel",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/dict/items?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/dict/types",
        "summary": "字典类型分页列表",
        "permission": [
          "system:dict:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "dictName",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "dictType",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/dict/types?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/dict/items",
        "summary": "新增字典项",
        "permission": [
          "system:dict:add"
        ],
        "isPublic": false,
        "action": "字典管理 · 新增",
        "params": [
          {
            "name": "dictType",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "所属字典类型编码",
            "example": "sys_demo"
          },
          {
            "name": "dictLabel",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "字典标签（展示文案）",
            "example": "示例标签"
          },
          {
            "name": "dictValue",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "字典值（业务存储值）",
            "example": "1"
          },
          {
            "name": "sort",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "排序",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "状态：1 启用 / 0 禁用",
            "example": 1
          },
          {
            "name": "remark",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "备注",
            "example": "示例备注"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/dict/items\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"dictType\": \"sys_demo\",\n      \"dictLabel\": \"示例标签\",\n      \"dictValue\": \"1\",\n      \"sort\": 1,\n      \"status\": 1,\n      \"remark\": \"示例备注\"\n    }'",
          "requestBody": {
            "dictType": "sys_demo",
            "dictLabel": "示例标签",
            "dictValue": "1",
            "sort": 1,
            "status": 1,
            "remark": "示例备注"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/dict/types",
        "summary": "新增字典类型",
        "permission": [
          "system:dict:add"
        ],
        "isPublic": false,
        "action": "字典管理 · 新增",
        "params": [
          {
            "name": "dictName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "字典名称",
            "example": "示例字典"
          },
          {
            "name": "dictType",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "字典类型编码（业务引用键，创建后不可修改）",
            "example": "sys_demo"
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "状态：1 启用 / 0 禁用",
            "example": 1
          },
          {
            "name": "remark",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "备注",
            "example": "示例备注"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/dict/types\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"dictName\": \"示例字典\",\n      \"dictType\": \"sys_demo\",\n      \"status\": 1,\n      \"remark\": \"示例备注\"\n    }'",
          "requestBody": {
            "dictName": "示例字典",
            "dictType": "sys_demo",
            "status": 1,
            "remark": "示例备注"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/dict/items/:id",
        "summary": "编辑字典项",
        "permission": [
          "system:dict:edit"
        ],
        "isPublic": false,
        "action": "字典管理 · 编辑",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "dictLabel",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "字典标签（展示文案）",
            "example": "示例标签"
          },
          {
            "name": "dictValue",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "字典值（业务存储值）",
            "example": "1"
          },
          {
            "name": "sort",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "排序",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "状态：1 启用 / 0 禁用",
            "example": 1
          },
          {
            "name": "remark",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "备注",
            "example": "示例备注"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/dict/items/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"dictLabel\": \"示例标签\",\n      \"dictValue\": \"1\",\n      \"sort\": 1,\n      \"status\": 1,\n      \"remark\": \"示例备注\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "dictLabel": "示例标签",
            "dictValue": "1",
            "sort": 1,
            "status": 1,
            "remark": "示例备注"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/dict/items/:id/status",
        "summary": "启用 / 禁用字典项（写操作，复用 system:dict:edit）",
        "permission": [
          "system:dict:edit"
        ],
        "isPublic": false,
        "action": "字典管理 · 编辑",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "目标状态：1 启用 / 0 禁用",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/dict/items/1/status\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"status\": 1\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "status": 1
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/dict/types/:id",
        "summary": "编辑字典类型",
        "permission": [
          "system:dict:edit"
        ],
        "isPublic": false,
        "action": "字典管理 · 编辑",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "dictName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "字典名称",
            "example": "示例字典"
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "状态：1 启用 / 0 禁用",
            "example": 1
          },
          {
            "name": "remark",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "备注",
            "example": "示例备注"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/dict/types/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"dictName\": \"示例字典\",\n      \"status\": 1,\n      \"remark\": \"示例备注\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "dictName": "示例字典",
            "status": 1,
            "remark": "示例备注"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/dict/types/:id/status",
        "summary": "启用 / 禁用字典类型（写操作，复用 system:dict:edit）",
        "permission": [
          "system:dict:edit"
        ],
        "isPublic": false,
        "action": "字典管理 · 编辑",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "目标状态：1 启用 / 0 禁用",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/dict/types/1/status\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"status\": 1\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "status": 1
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/dict/items",
        "summary": "批量删除字典项（逐条执行并返回被跳过明细）",
        "permission": [
          "system:dict:remove"
        ],
        "isPublic": false,
        "action": "字典管理 · 批量删除",
        "params": [
          {
            "name": "ids",
            "in": "body",
            "type": "number[]",
            "required": true,
            "description": "",
            "example": []
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/dict/items\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"ids\": []\n    }'",
          "requestBody": {
            "ids": []
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/dict/items/:id",
        "summary": "删除字典项",
        "permission": [
          "system:dict:remove"
        ],
        "isPublic": false,
        "action": "字典管理 · 删除",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/dict/items/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/dict/types",
        "summary": "批量删除字典类型（连带删除各自字典项；逐条执行并返回被跳过明细）",
        "permission": [
          "system:dict:remove"
        ],
        "isPublic": false,
        "action": "字典管理 · 批量删除",
        "params": [
          {
            "name": "ids",
            "in": "body",
            "type": "number[]",
            "required": true,
            "description": "",
            "example": []
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/dict/types\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"ids\": []\n    }'",
          "requestBody": {
            "ids": []
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/dict/types/:id",
        "summary": "删除字典类型（连带删除其下字典项）",
        "permission": [
          "system:dict:remove"
        ],
        "isPublic": false,
        "action": "字典管理 · 删除",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/dict/types/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "参数管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/configs",
        "summary": "参数分页列表",
        "permission": [
          "system:config:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "configName",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "configKey",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/configs?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/configs/:id",
        "summary": "参数详情",
        "permission": [
          "system:config:query"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/configs/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/configs/data/:configKey",
        "summary": "按键取参数值（业务取数，仅需登录、不设权限码）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "configKey",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "sys.demo.key"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/configs/data/sys.demo.key\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "configKey": "sys.demo.key"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/configs",
        "summary": "新增参数",
        "permission": [
          "system:config:add"
        ],
        "isPublic": false,
        "action": "参数管理 · 新增",
        "params": [
          {
            "name": "configName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "参数名称",
            "example": "示例参数"
          },
          {
            "name": "configKey",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "参数键名（业务引用键，创建后不可修改）",
            "example": "sys.demo.key"
          },
          {
            "name": "configValue",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "参数值",
            "example": "示例值"
          },
          {
            "name": "remark",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "备注",
            "example": "示例备注"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/configs\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"configName\": \"示例参数\",\n      \"configKey\": \"sys.demo.key\",\n      \"configValue\": \"示例值\",\n      \"remark\": \"示例备注\"\n    }'",
          "requestBody": {
            "configName": "示例参数",
            "configKey": "sys.demo.key",
            "configValue": "示例值",
            "remark": "示例备注"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/configs/:id",
        "summary": "编辑参数（键名不可改）",
        "permission": [
          "system:config:edit"
        ],
        "isPublic": false,
        "action": "参数管理 · 编辑",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "configName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "参数名称",
            "example": "示例参数"
          },
          {
            "name": "configValue",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "参数值",
            "example": "示例值"
          },
          {
            "name": "remark",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "备注",
            "example": "示例备注"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/configs/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"configName\": \"示例参数\",\n      \"configValue\": \"示例值\",\n      \"remark\": \"示例备注\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "configName": "示例参数",
            "configValue": "示例值",
            "remark": "示例备注"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/configs/:id",
        "summary": "删除参数（内置参数不可删除）",
        "permission": [
          "system:config:remove"
        ],
        "isPublic": false,
        "action": "参数管理 · 删除",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/configs/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "定时任务",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/tasks",
        "summary": "定时任务列表（含调度状态与上次执行摘要）",
        "permission": [
          "system:task:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/tasks?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/tasks/:name/logs",
        "summary": "某任务的执行记录（分页）。 查询参数用 `Record<string, unknown>` 而非 DTO：全局 ValidationPipe 开了 whitelist， DTO 里未声明的字段（page / pageSize）会被剥掉，导致分页参数丢失。 故与日志模块保持一致，筛选条件的解析放在 service 层",
        "permission": [
          "system:task:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "name",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "log-archive"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/tasks/log-archive/logs\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "name": "log-archive"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/tasks/:name/run",
        "summary": "手动触发任务（同步等待执行结果）",
        "permission": [
          "system:task:run"
        ],
        "isPublic": false,
        "action": "定时任务 · 手动执行",
        "params": [
          {
            "name": "name",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "log-archive"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/tasks/log-archive/run\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "name": "log-archive"
          }
        }
      }
    ]
  },
  {
    "group": "日志管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/logs/http",
        "summary": "HTTP 访问日志列表",
        "permission": [
          "log:http:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/logs/http?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/logs/http/detail/:id",
        "summary": "HTTP 日志详情（请求 / 响应体按需加载）",
        "permission": [
          "log:http:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/logs/http/detail/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/logs/http/export",
        "summary": "导出 HTTP 访问日志 CSV（流式）",
        "permission": [
          "log:http:export"
        ],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/logs/http/export\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "isRawResponse": true
        }
      },
      {
        "method": "GET",
        "path": "/api/logs/login",
        "summary": "登录日志列表",
        "permission": [
          "log:login:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/logs/login?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/logs/login/export",
        "summary": "导出登录日志 CSV（流式：分批查、逐批写，内存不随行数增长）",
        "permission": [
          "log:login:export"
        ],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/logs/login/export\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "isRawResponse": true
        }
      },
      {
        "method": "GET",
        "path": "/api/logs/operation",
        "summary": "操作日志列表",
        "permission": [
          "log:operation:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/logs/operation?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/logs/operation/export",
        "summary": "导出操作日志 CSV（流式）",
        "permission": [
          "log:operation:export"
        ],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/logs/operation/export\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "isRawResponse": true
        }
      },
      {
        "method": "DELETE",
        "path": "/api/logs/http",
        "summary": "清空所有 HTTP 访问日志（高危操作，独立权限码 log:http:clear）",
        "permission": [
          "log:http:clear"
        ],
        "isPublic": false,
        "action": "日志管理 · 清空 HTTP 日志",
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/logs/http\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "DELETE",
        "path": "/api/logs/http/:id",
        "summary": "删除单条 HTTP 访问日志",
        "permission": [
          "log:http:remove"
        ],
        "isPublic": false,
        "action": "日志管理 · 删除 HTTP 日志",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/logs/http/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/logs/http/batch",
        "summary": "批量删除 HTTP 访问日志（多选）",
        "permission": [
          "log:http:remove"
        ],
        "isPublic": false,
        "action": "日志管理 · 批量删除 HTTP 日志",
        "params": [
          {
            "name": "ids",
            "in": "body",
            "type": "number[]",
            "required": true,
            "description": "",
            "example": []
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/logs/http/batch\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"ids\": []\n    }'",
          "requestBody": {
            "ids": []
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/logs/login/:id",
        "summary": "删除单条登录日志",
        "permission": [
          "log:login:remove"
        ],
        "isPublic": false,
        "action": "日志管理 · 删除登录日志",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/logs/login/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/logs/login/batch",
        "summary": "批量删除登录日志（多选）",
        "permission": [
          "log:login:remove"
        ],
        "isPublic": false,
        "action": "日志管理 · 批量删除登录日志",
        "params": [
          {
            "name": "ids",
            "in": "body",
            "type": "number[]",
            "required": true,
            "description": "",
            "example": []
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/logs/login/batch\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"ids\": []\n    }'",
          "requestBody": {
            "ids": []
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/logs/operation/:id",
        "summary": "删除单条操作日志",
        "permission": [
          "log:operation:remove"
        ],
        "isPublic": false,
        "action": "日志管理 · 删除操作日志",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/logs/operation/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/logs/operation/batch",
        "summary": "批量删除操作日志（多选）",
        "permission": [
          "log:operation:remove"
        ],
        "isPublic": false,
        "action": "日志管理 · 批量删除操作日志",
        "params": [
          {
            "name": "ids",
            "in": "body",
            "type": "number[]",
            "required": true,
            "description": "",
            "example": []
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/logs/operation/batch\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"ids\": []\n    }'",
          "requestBody": {
            "ids": []
          }
        }
      }
    ]
  },
  {
    "group": "文件管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/files",
        "summary": "文件列表",
        "permission": [
          "file:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "originName",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "mimeType",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "uploaderId",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "bizType",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "bizId",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "startTime",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "endTime",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "minSize",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "maxSize",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/files?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/files/:id/download",
        "summary": "下载文件：强制附件语义（Content-Disposition: attachment）。 中文文件名由 Express 自动编码；CR/LF/引号已去除避免响应头注入",
        "permission": [
          "file:download"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/files/1/download\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          },
          "isRawResponse": true
        }
      },
      {
        "method": "GET",
        "path": "/api/files/check",
        "summary": "秒传预检：按内容哈希查询库内是否已存在相同文件",
        "permission": [
          "file:upload"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "hash",
            "in": "query",
            "type": "string",
            "required": true,
            "description": "",
            "example": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/files/check?hash=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/files/quota",
        "summary": "当前用户的上传配额使用情况（供前端展示「已用 / 上限」）",
        "permission": [
          "file:upload"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/files/quota?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/files/types",
        "summary": "文件类型选项（对库内已有文件去重，供筛选下拉使用）",
        "permission": [
          "file:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/files/types?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/files/uploaders",
        "summary": "上传人选项（对库内已有上传人去重并关联用户表）",
        "permission": [
          "file:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/files/uploaders?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/files/upload",
        "summary": "上传（单/多文件，兼容任意字段名）",
        "permission": [
          "file:upload"
        ],
        "isPublic": false,
        "action": "文件管理 · 上传",
        "params": [
          {
            "name": "bizType",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "业务类型：模块标识，只允许字母/数字/下划线/连字符（避免塞入任意文本污染筛选）",
            "example": "示例值"
          },
          {
            "name": "bizId",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "业务主键：表单里是字符串，需显式转数字后校验",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/files/upload\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"bizType\": \"示例值\",\n      \"bizId\": 1\n    }'",
          "requestBody": {
            "bizType": "示例值",
            "bizId": 1
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/files/:id",
        "summary": "删除文件",
        "permission": [
          "file:remove"
        ],
        "isPublic": false,
        "action": "文件管理 · 删除",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/files/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "代码生成",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/gen/tables",
        "summary": "列出全部业务表（读 information_schema.TABLES）",
        "permission": [
          "tool:gen:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/gen/tables?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/gen/tables/:tableName",
        "summary": "指定表的字段结构详情",
        "permission": [
          "tool:gen:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "tableName",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "sys_config"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/gen/tables/sys_config\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "tableName": "sys_config"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/gen/create",
        "summary": "生成代码并直接写入项目目录（含自动接线）",
        "permission": [
          "tool:gen:create"
        ],
        "isPublic": false,
        "action": "代码生成 · 写入项目",
        "params": [
          {
            "name": "overwrite",
            "in": "body",
            "type": "boolean",
            "required": false,
            "description": "同名文件已存在时是否覆盖（默认 false → 409 冲突）",
            "example": false
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/gen/create\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"overwrite\": false\n    }'",
          "requestBody": {
            "overwrite": false
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/gen/download",
        "summary": "生成并下载代码（ZIP 二进制流）",
        "permission": [
          "tool:gen:download"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "tableName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "数据库表名（必须真实存在）",
            "example": "sys_config"
          },
          {
            "name": "moduleName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "模块名（如 system）：字母开头，仅字母数字",
            "example": "demo"
          },
          {
            "name": "businessName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "业务名（如 user）：字母开头，仅字母数字，会拼进生成物路径",
            "example": "demo"
          },
          {
            "name": "author",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "作者（写入文件头注释）",
            "example": "作者"
          },
          {
            "name": "isTree",
            "in": "body",
            "type": "boolean",
            "required": false,
            "description": "是否树形表：列表返回整棵树、不生成分页",
            "example": false
          },
          {
            "name": "treeParentField",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "树形表父级字段名（默认 parentId）",
            "example": "示例值"
          },
          {
            "name": "columnOptions",
            "in": "body",
            "type": "GenColumnOptionDto[]",
            "required": false,
            "description": "各字段的控件类型 / 字典绑定（按 columnName 合并）",
            "example": [
              {
                "columnName": "示例值",
                "htmlType": "示例值",
                "dictType": "sys_demo"
              }
            ]
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/gen/download\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"tableName\": \"sys_config\",\n      \"moduleName\": \"demo\",\n      \"businessName\": \"demo\",\n      \"author\": \"作者\",\n      \"isTree\": false,\n      \"treeParentField\": \"示例值\",\n      \"columnOptions\": []\n    }'",
          "requestBody": {
            "tableName": "sys_config",
            "moduleName": "demo",
            "businessName": "demo",
            "author": "作者",
            "isTree": false,
            "treeParentField": "示例值",
            "columnOptions": []
          },
          "isRawResponse": true
        }
      },
      {
        "method": "POST",
        "path": "/api/gen/preview",
        "summary": "在线预览生成的代码（返回文件列表）",
        "permission": [
          "tool:gen:preview"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "tableName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "数据库表名（必须真实存在）",
            "example": "sys_config"
          },
          {
            "name": "moduleName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "模块名（如 system）：字母开头，仅字母数字",
            "example": "demo"
          },
          {
            "name": "businessName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "业务名（如 user）：字母开头，仅字母数字，会拼进生成物路径",
            "example": "demo"
          },
          {
            "name": "author",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "作者（写入文件头注释）",
            "example": "作者"
          },
          {
            "name": "isTree",
            "in": "body",
            "type": "boolean",
            "required": false,
            "description": "是否树形表：列表返回整棵树、不生成分页",
            "example": false
          },
          {
            "name": "treeParentField",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "树形表父级字段名（默认 parentId）",
            "example": "示例值"
          },
          {
            "name": "columnOptions",
            "in": "body",
            "type": "GenColumnOptionDto[]",
            "required": false,
            "description": "各字段的控件类型 / 字典绑定（按 columnName 合并）",
            "example": [
              {
                "columnName": "示例值",
                "htmlType": "示例值",
                "dictType": "sys_demo"
              }
            ]
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/gen/preview\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"tableName\": \"sys_config\",\n      \"moduleName\": \"demo\",\n      \"businessName\": \"demo\",\n      \"author\": \"作者\",\n      \"isTree\": false,\n      \"treeParentField\": \"示例值\",\n      \"columnOptions\": []\n    }'",
          "requestBody": {
            "tableName": "sys_config",
            "moduleName": "demo",
            "businessName": "demo",
            "author": "作者",
            "isTree": false,
            "treeParentField": "示例值",
            "columnOptions": []
          }
        }
      }
    ]
  },
  {
    "group": "个人中心",
    "endpoints": [
      {
        "method": "POST",
        "path": "/api/profile/avatar",
        "summary": "更换头像",
        "permission": [],
        "isPublic": false,
        "action": "个人中心 · 更换头像",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/profile/avatar\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "PUT",
        "path": "/api/profile",
        "summary": "修改资料",
        "permission": [],
        "isPublic": false,
        "action": "个人中心 · 修改资料",
        "params": [
          {
            "name": "nickname",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例用户"
          },
          {
            "name": "email",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "邮箱：空串或合法邮箱（空串表示清空）。",
            "example": "demo@example.com"
          },
          {
            "name": "phone",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "手机号：空串或合法手机号。",
            "example": "13800138000"
          },
          {
            "name": "gender",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "性别：空串或最多 20 字符。",
            "example": "1"
          },
          {
            "name": "avatar",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "头像地址：最多 255 字符。",
            "example": "/static/2026/avatar.png"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/profile\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"nickname\": \"示例用户\",\n      \"email\": \"demo@example.com\",\n      \"phone\": \"13800138000\",\n      \"gender\": \"1\",\n      \"avatar\": \"/static/2026/avatar.png\"\n    }'",
          "requestBody": {
            "nickname": "示例用户",
            "email": "demo@example.com",
            "phone": "13800138000",
            "gender": "1",
            "avatar": "/static/2026/avatar.png"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/profile/password",
        "summary": "修改密码",
        "permission": [],
        "isPublic": false,
        "action": "个人中心 · 修改密码",
        "params": [
          {
            "name": "oldPassword",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "123456"
          },
          {
            "name": "newPassword",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "123456"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/profile/password\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"oldPassword\": \"123456\",\n      \"newPassword\": \"123456\"\n    }'",
          "requestBody": {
            "oldPassword": "123456",
            "newPassword": "123456"
          }
        }
      }
    ]
  },
  {
    "group": "接口文档",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/docs",
        "summary": "全部接口清单（按业务模块分组）",
        "permission": [],
        "isPublic": true,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/docs?page=1&pageSize=10\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/docs/openapi.json",
        "summary": "OpenAPI 3.0 文档（注入响应示例，server 指向当前运行实例，可直接被 Swagger UI 消费）",
        "permission": [],
        "isPublic": true,
        "action": "",
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/docs/openapi.json\"",
          "isRawResponse": true
        }
      }
    ]
  },
  {
    "group": "在线用户",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/monitor/online",
        "summary": "在线会话列表",
        "permission": [
          "monitor:online:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "username",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "ip",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/monitor/online?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/monitor/online/:sid",
        "summary": "强制下线单个会话",
        "permission": [
          "monitor:online:forceLogout"
        ],
        "isPublic": false,
        "action": "在线用户 · 强制下线",
        "params": [
          {
            "name": "sid",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/monitor/online/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "sid": "1"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/monitor/online/user/:userId",
        "summary": "强制下线某用户的全部会话",
        "permission": [
          "monitor:online:forceLogout"
        ],
        "isPublic": false,
        "action": "在线用户 · 强制下线全部会话",
        "params": [
          {
            "name": "userId",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/monitor/online/user/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "userId": "1"
          }
        }
      }
    ]
  },
  {
    "group": "系统监控",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/monitor/server",
        "summary": "系统资源快照。 刻意**不记操作日志**：页面每几秒轮询一次，记日志只会把 sys_operation_log 灌满噪音， 而\"读指标\"本身没有审计价值（真正需要留痕的是强退这类写操作）",
        "permission": [
          "monitor:server:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/monitor/server?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      }
    ]
  },
  {
    "group": "通知中心",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/notices",
        "summary": "我的收件箱（未读优先 + 时间倒序）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "isRead",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "noticeType",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "title",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/notices?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/notices/unread-count",
        "summary": "未读数（顶栏红点）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/notices/unread-count?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/notices",
        "summary": "发布通知（指定人或全员）",
        "permission": [
          "system:notice:add"
        ],
        "isPublic": false,
        "action": "通知中心 · 发布通知",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/notices\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "PUT",
        "path": "/api/notices/:id/read",
        "summary": "标记已读",
        "permission": [],
        "isPublic": false,
        "action": "通知中心 · 标记已读",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/notices/1/read\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/notices/read-all",
        "summary": "全部标记已读",
        "permission": [],
        "isPublic": false,
        "action": "通知中心 · 全部已读",
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/notices/read-all\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "DELETE",
        "path": "/api/notices",
        "summary": "清空我的通知",
        "permission": [],
        "isPublic": false,
        "action": "通知中心 · 清空通知",
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/notices\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "DELETE",
        "path": "/api/notices/:id",
        "summary": "删除一条通知",
        "permission": [],
        "isPublic": false,
        "action": "通知中心 · 删除通知",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/notices/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "系统",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api",
        "summary": "健康检查：返回服务名称、状态与服务器时间",
        "permission": [],
        "isPublic": true,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api?page=1&pageSize=10\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/health/live",
        "summary": "存活探针：仅证明进程可响应，不探测任何依赖（供 livenessProbe）",
        "permission": [],
        "isPublic": true,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/health/live?page=1&pageSize=10\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/health/ready",
        "summary": "就绪探针：探测 MySQL 与 Redis；MySQL 不可用返回 503，Redis 不可用标记 degraded（仍 200）",
        "permission": [],
        "isPublic": true,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/health/ready?page=1&pageSize=10\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      }
    ]
  },
  {
    "group": "部门/岗位管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/depts",
        "summary": "部门列表（tree=1 时返回树）",
        "permission": [
          "system:dept:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "deptName",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "tree",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/depts?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/depts/:id",
        "summary": "部门详情",
        "permission": [
          "system:dept:query"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/depts/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/depts/tree",
        "summary": "完整部门树（上级选择）",
        "permission": [
          "system:dept:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/depts/tree?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/depts",
        "summary": "新增部门",
        "permission": [
          "system:dept:add"
        ],
        "isPublic": false,
        "action": "部门/岗位管理 · 新增",
        "params": [
          {
            "name": "parentId",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "deptType",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "类型：1 部门 / 2 岗位（岗位为叶子节点，不能再挂下级）",
            "example": 1
          },
          {
            "name": "deptName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例部门"
          },
          {
            "name": "leader",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "张三"
          },
          {
            "name": "phone",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "13800138000"
          },
          {
            "name": "email",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "demo@example.com"
          },
          {
            "name": "sort",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/depts\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"parentId\": 1,\n      \"deptType\": 1,\n      \"deptName\": \"示例部门\",\n      \"leader\": \"张三\",\n      \"phone\": \"13800138000\",\n      \"email\": \"demo@example.com\",\n      \"sort\": 1,\n      \"status\": 1\n    }'",
          "requestBody": {
            "parentId": 1,
            "deptType": 1,
            "deptName": "示例部门",
            "leader": "张三",
            "phone": "13800138000",
            "email": "demo@example.com",
            "sort": 1,
            "status": 1
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/depts/:id",
        "summary": "编辑部门",
        "permission": [
          "system:dept:edit"
        ],
        "isPublic": false,
        "action": "部门/岗位管理 · 编辑",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "parentId",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "deptType",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "类型：1 部门 / 2 岗位（岗位为叶子节点，不能再挂下级）",
            "example": 1
          },
          {
            "name": "deptName",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例部门"
          },
          {
            "name": "leader",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "张三"
          },
          {
            "name": "phone",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "13800138000"
          },
          {
            "name": "email",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "demo@example.com"
          },
          {
            "name": "sort",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/depts/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"parentId\": 1,\n      \"deptType\": 1,\n      \"deptName\": \"示例部门\",\n      \"leader\": \"张三\",\n      \"phone\": \"13800138000\",\n      \"email\": \"demo@example.com\",\n      \"sort\": 1,\n      \"status\": 1\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "parentId": 1,
            "deptType": 1,
            "deptName": "示例部门",
            "leader": "张三",
            "phone": "13800138000",
            "email": "demo@example.com",
            "sort": 1,
            "status": 1
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/depts/:id",
        "summary": "删除部门",
        "permission": [
          "system:dept:remove"
        ],
        "isPublic": false,
        "action": "部门/岗位管理 · 删除",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/depts/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "词根词典",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/word-roots",
        "summary": "分页列表（筛选：关键词 / 来源）",
        "permission": [
          "sentence:wordroot:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "keyword",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "source",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/word-roots?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/word-roots/:id",
        "summary": "详情",
        "permission": [
          "sentence:wordroot:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/word-roots/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/word-roots/analyze",
        "summary": "按单词立即解析并入库（单条，通常 3~10s）",
        "permission": [
          "sentence:wordroot:gen"
        ],
        "isPublic": false,
        "action": "词根词典 · 立即解析",
        "params": [
          {
            "name": "word",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/word-roots/analyze\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"word\": \"示例值\"\n    }'",
          "requestBody": {
            "word": "示例值"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/word-roots/:id",
        "summary": "编辑",
        "permission": [
          "sentence:wordroot:edit"
        ],
        "isPublic": false,
        "action": "词根词典 · 编辑",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "phonetic",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "meaning",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "analysisJson",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "结构化解析（JSON 字符串，形如 {\"parts\":[...],\"explanation\":\"\",\"related\":[]}）。 用字符串而非对象接收：白名单校验需要明确的形状，且前端用 JSON 文本域编辑。",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/word-roots/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"phonetic\": \"示例值\",\n      \"meaning\": \"示例值\",\n      \"analysisJson\": \"示例值\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "phonetic": "示例值",
            "meaning": "示例值",
            "analysisJson": "示例值"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/word-roots/:id",
        "summary": "删除",
        "permission": [
          "sentence:wordroot:remove"
        ],
        "isPublic": false,
        "action": "词根词典 · 删除",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/word-roots/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "句签管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/sentence-cards",
        "summary": "分页列表（筛选：status / 日期区间 / 关键词）",
        "permission": [
          "sentence:card:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "status",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "keyword",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "startDate",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "endDate",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/sentence-cards?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/sentence-cards/:id",
        "summary": "详情（含最近领取用户）",
        "permission": [
          "sentence:card:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/sentence-cards/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/sentence-cards/generate",
        "summary": "按日期重新生成（同步等待 AI 文案 + 生图，通常 10~40s）。 ⚠️ 必须声明在 `@Get(':id')` 之前不是必需的（方法不同），但保持与其他模块一致的可读性",
        "permission": [
          "sentence:card:gen"
        ],
        "isPublic": false,
        "action": "句签管理 · 重新生成",
        "params": [
          {
            "name": "bizDate",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "业务日期（YYYY-MM-DD）",
            "example": "示例值"
          },
          {
            "name": "force",
            "in": "body",
            "type": "boolean",
            "required": false,
            "description": "已就绪时是否强制覆盖。 缺省按 true 处理——运营点「重新生成」的意图就是要换一张。",
            "example": true
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentence-cards/generate\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"bizDate\": \"示例值\",\n      \"force\": true\n    }'",
          "requestBody": {
            "bizDate": "示例值",
            "force": true
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/sentence-cards/:id",
        "summary": "编辑文案",
        "permission": [
          "sentence:card:edit"
        ],
        "isPublic": false,
        "action": "句签管理 · 编辑文案",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "title",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "titleZh",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "sentenceEn",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "translationZh",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "blessing",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/sentence-cards/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"title\": \"示例值\",\n      \"titleZh\": \"示例值\",\n      \"sentenceEn\": \"示例值\",\n      \"translationZh\": \"示例值\",\n      \"blessing\": \"示例值\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "title": "示例值",
            "titleZh": "示例值",
            "sentenceEn": "示例值",
            "translationZh": "示例值",
            "blessing": "示例值"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/sentence-cards/:id",
        "summary": "删除（连带领取记录）",
        "permission": [
          "sentence:card:remove"
        ],
        "isPublic": false,
        "action": "句签管理 · 删除",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/sentence-cards/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "客户端反馈",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client-feedbacks",
        "summary": "反馈列表（筛选：status / type / platform / keyword）",
        "permission": [
          "client:feedback:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "status",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "type",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "platform",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "keyword",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client-feedbacks?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/client-feedbacks/:id",
        "summary": "处理反馈（标记已处理/已驳回 + 回复 + 内部备注）",
        "permission": [
          "client:feedback:handle"
        ],
        "isPublic": false,
        "action": "客户端反馈 · 处理反馈",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "status",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "处理结果：resolved 已处理 / dismissed 已驳回",
            "example": "示例值"
          },
          {
            "name": "reply",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "给用户的回复（可选）。 **会下发用户端**——用户在「我的反馈」能看到，是「意见被听见」的闭环； 与内部备注 `handleNote` 分开，后者只给运营看。",
            "example": "示例值"
          },
          {
            "name": "handleNote",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "内部处理备注（可选；**不下发**用户端）",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/client-feedbacks/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"status\": \"示例值\",\n      \"reply\": \"示例值\",\n      \"handleNote\": \"示例值\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "status": "示例值",
            "reply": "示例值",
            "handleNote": "示例值"
          }
        }
      }
    ]
  },
  {
    "group": "客户端通知",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client-notices",
        "summary": "公告列表（含草稿/已撤回，带已读人数）",
        "permission": [
          "client:notice:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "status",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "noticeType",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "title",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client-notices?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client-notices",
        "summary": "发布公告",
        "permission": [
          "client:notice:add"
        ],
        "isPublic": false,
        "action": "客户端通知 · 发布公告",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client-notices\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "PUT",
        "path": "/api/client-notices/:id",
        "summary": "编辑公告",
        "permission": [
          "client:notice:edit"
        ],
        "isPublic": false,
        "action": "客户端通知 · 编辑公告",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/client-notices/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/client-notices/:id/status",
        "summary": "发布 / 撤回",
        "permission": [
          "client:notice:edit"
        ],
        "isPublic": false,
        "action": "客户端通知 · 发布/撤回公告",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/client-notices/1/status\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/client-notices/:id",
        "summary": "删除公告",
        "permission": [
          "client:notice:remove"
        ],
        "isPublic": false,
        "action": "客户端通知 · 删除公告",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/client-notices/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "客户端用户",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client-users",
        "summary": "分页列表（关键词 / 状态 / 性别）。 查询参数用 `Record<string, unknown>` 而非 DTO：全局 ValidationPipe 开了 whitelist， DTO 里未声明的字段（page / pageSize）会被剥掉，导致分页参数丢失——翻页时永远回第 1 页 （症状：列表里翻不到的人，一搜关键词却能搜到）。故与日志 / 任务模块保持一致， 筛选条件的解析全部放在 service 层",
        "permission": [
          "client:user:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client-users?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client-users/:id",
        "summary": "详情（含学习数据与最近答题）",
        "permission": [
          "client:user:query"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client-users/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client-users/:id/ai-quota",
        "summary": "今日 AI 额度用量（运营排查「这个人是不是把 AI 刷爆了」用）",
        "permission": [
          "client:user:query"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client-users/1/ai-quota\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client-users/:id/growth",
        "summary": "成长概览（XP / 等级 / 成就 / 场景地图）——与客户端个人中心「成长」同源",
        "permission": [
          "client:user:query"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client-users/1/growth\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client-users/:id/sentence-cards",
        "summary": "已获得的句签列表（按获得时间倒序）",
        "permission": [
          "client:user:query"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client-users/1/sentence-cards\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client-users/export",
        "summary": "导出客户端用户 CSV（流式；筛选与列表共用同一套条件）",
        "permission": [
          "client:user:query"
        ],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client-users/export\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "isRawResponse": true
        }
      },
      {
        "method": "POST",
        "path": "/api/client-users/:id/offline",
        "summary": "强制下线（不改密码，仅令旧令牌失效）",
        "permission": [
          "client:user:offline"
        ],
        "isPublic": false,
        "action": "客户端用户 · 强制下线",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client-users/1/offline\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client-users/:id/sentence-cards/backfill",
        "summary": "补发过往漏领的句签（历史达标日 + 当日句签已就绪；幂等，重复调用不重复发）",
        "permission": [
          "client:user:edit"
        ],
        "isPublic": false,
        "action": "客户端用户 · 补发句签",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client-users/1/sentence-cards/backfill\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/client-users/:id/password",
        "summary": "重置密码（同时强制下线）",
        "permission": [
          "client:user:reset"
        ],
        "isPublic": false,
        "action": "客户端用户 · 重置密码",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/client-users/1/password\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/client-users/:id/status",
        "summary": "启用 / 禁用",
        "permission": [
          "client:user:edit"
        ],
        "isPublic": false,
        "action": "客户端用户 · 修改状态",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/client-users/1/status\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/client-users/:id",
        "summary": "删除用户（级联清理学习数据；日志类表不动，保留审计痕迹）",
        "permission": [
          "client:user:delete"
        ],
        "isPublic": false,
        "action": "客户端用户 · 删除用户",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/client-users/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "题库管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/reports",
        "summary": "分页列表（筛选：status/reason/keyword）",
        "permission": [
          "sentence:report"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "status",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "reason",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "keyword",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/reports?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/sentences",
        "summary": "分页列表（筛选：status/categoryId/difficulty/keyword）",
        "permission": [
          "sentence:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/sentences?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/sentences/:id",
        "summary": "详情",
        "permission": [
          "sentence:query"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/sentences/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/sentences/categories",
        "summary": "场景分类列表（含题目数）。 ⚠️ 必须声明在 `@Get(':id')` 之前：Nest 按声明顺序匹配，否则 `categories` 会被 `:id` 吃掉",
        "permission": [
          "sentence:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/sentences/categories?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/sentences/export",
        "summary": "导出题库 CSV（流式；筛选与列表共用同一套条件）。 权限用 `sentence:query` 而不是新增 `sentence:export`：导出是只读操作， 且权限码是种子数据里写死的，为一个导出动作加码需要重跑 seed——收益不抵风险",
        "permission": [
          "sentence:query"
        ],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/sentences/export\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "isRawResponse": true
        }
      },
      {
        "method": "GET",
        "path": "/api/sentences/gen-tasks",
        "summary": "生成批次列表（运营监控）。 ⚠️ 必须声明在 `@Get(':id')` 之前：Nest 按声明顺序匹配，否则 `gen-tasks` 会被 `:id` 吃掉， 触发 IdParamDto 校验 → 报「id 必须为正整数」（2026-10-24 真实缺陷：点「生成题库」后 前端紧接着拉批次列表，于是刚提示成功就弹出这个错）",
        "permission": [
          "sentence:gen"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/sentences/gen-tasks?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences",
        "summary": "手工创建题目",
        "permission": [
          "sentence:add"
        ],
        "isPublic": false,
        "action": "题库管理 · 新增题目",
        "params": [
          {
            "name": "categoryId",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "",
            "example": 1
          },
          {
            "name": "sentenceEn",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "translationZh",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "ipa",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "scenePrompt",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "difficulty",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"categoryId\": 1,\n      \"sentenceEn\": \"示例值\",\n      \"translationZh\": \"示例值\",\n      \"ipa\": \"示例值\",\n      \"scenePrompt\": \"示例值\",\n      \"difficulty\": 1,\n      \"status\": \"示例值\"\n    }'",
          "requestBody": {
            "categoryId": 1,
            "sentenceEn": "示例值",
            "translationZh": "示例值",
            "ipa": "示例值",
            "scenePrompt": "示例值",
            "difficulty": 1,
            "status": "示例值"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/:id/regenerate-image",
        "summary": "单题重新生图（异步，立即返回）。 权限沿用 `sentence:gen`：会消耗 AI 生图配额，与「生成题库」同属生成类操作， 为一个按钮新增权限码还得重跑 seed，不划算。 生图要 10~40 秒，超过管理端 15 秒请求超时，所以这里只负责受理",
        "permission": [
          "sentence:gen"
        ],
        "isPublic": false,
        "action": "题库管理 · 重新生图",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "scenePrompt",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/1/regenerate-image\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"scenePrompt\": \"示例值\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "scenePrompt": "示例值"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/batch-regenerate-image",
        "summary": "批量重新生图（异步，立即返回；单题接口的批量版，换配图风格时用）。 与批量上下架不同，这里**不要求全部成功**：单题不存在、正在生成中、已有生图 任务在跑的会被跳过并在响应里回给前端，其余题照常受理",
        "permission": [
          "sentence:gen"
        ],
        "isPublic": false,
        "action": "题库管理 · 批量重新生图",
        "params": [
          {
            "name": "ids",
            "in": "body",
            "type": "number[]",
            "required": true,
            "description": "",
            "example": []
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/batch-regenerate-image\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"ids\": []\n    }'",
          "requestBody": {
            "ids": []
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/batch-status",
        "summary": "批量上下架（运营清理题库用；上架只对已有配图的题生效）",
        "permission": [
          "sentence:edit"
        ],
        "isPublic": false,
        "action": "题库管理 · 批量上下架",
        "params": [
          {
            "name": "ids",
            "in": "body",
            "type": "number[]",
            "required": true,
            "description": "",
            "example": []
          },
          {
            "name": "status",
            "in": "body",
            "type": "SentenceStatus",
            "required": true,
            "description": "",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/batch-status\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"ids\": [],\n      \"status\": \"示例值\"\n    }'",
          "requestBody": {
            "ids": [],
            "status": "示例值"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/categories",
        "summary": "新增分类",
        "permission": [
          "sentence:category"
        ],
        "isPublic": false,
        "action": "题库管理 · 新增分类",
        "params": [
          {
            "name": "name",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "分类名称（中文，唯一）",
            "example": "log-archive"
          },
          {
            "name": "nameEn",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "英文名（客户端卡片副标题）",
            "example": "示例值"
          },
          {
            "name": "icon",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "图标：**lucide 图标名**（不带前缀）。 Web 端拼 `i-lucide-*`、App 端查 `android/lib/theme/icon_map.dart`， 所以名字必须是 lucide 里真实存在的，否则 Web 端会画不出图标。",
            "example": "示例值"
          },
          {
            "name": "sort",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "排序（升序）",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "1 启用 / 0 禁用",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/categories\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"name\": \"log-archive\",\n      \"nameEn\": \"示例值\",\n      \"icon\": \"示例值\",\n      \"sort\": 1,\n      \"status\": 1\n    }'",
          "requestBody": {
            "name": "log-archive",
            "nameEn": "示例值",
            "icon": "示例值",
            "sort": 1,
            "status": 1
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/gen-tasks/:id/cancel",
        "summary": "取消批次（终态 cancelled，之后可删除）",
        "permission": [
          "sentence:gen"
        ],
        "isPublic": false,
        "action": "题库管理 · 取消生成",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/gen-tasks/1/cancel\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/gen-tasks/:id/pause",
        "summary": "暂停批次（在下一个批次边界生效，最长等一个批次，约 1~2 分钟）",
        "permission": [
          "sentence:gen"
        ],
        "isPublic": false,
        "action": "题库管理 · 暂停生成",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/gen-tasks/1/pause\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/gen-tasks/:id/resume",
        "summary": "继续批次（从已完成进度接着跑，不会重复生成）",
        "permission": [
          "sentence:gen"
        ],
        "isPublic": false,
        "action": "题库管理 · 继续生成",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/gen-tasks/1/resume\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/gen/batch",
        "summary": "手动触发批量生成（异步执行，进度看批次列表）。 传 difficulty 则本批全部出该难度（定向补某一档），否则按自然分布",
        "permission": [
          "sentence:gen"
        ],
        "isPublic": false,
        "action": "题库管理 · 触发生成",
        "params": [
          {
            "name": "count",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "本次目标数量（缺省取配置 SENTENCE_DAILY_TARGET）",
            "example": 1
          },
          {
            "name": "difficulty",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "强制本批全部为该难度（1 易 / 2 中 / 3 难；省略则按 40/40/20 自然分布）。 用于「某一档题目不够用」时定向补题，例如基础档被抽空。",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/gen/batch\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"count\": 1,\n      \"difficulty\": 1\n    }'",
          "requestBody": {
            "count": 1,
            "difficulty": 1
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/reports/:id",
        "summary": "处理举报（标记已处理/已驳回 + 备注）",
        "permission": [
          "sentence:report:handle"
        ],
        "isPublic": false,
        "action": "题库管理 · 处理举报",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "status",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "处理结果：resolved 已处理 / dismissed 已驳回",
            "example": "示例值"
          },
          {
            "name": "handleNote",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "处理备注（可选）",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/reports/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"status\": \"示例值\",\n      \"handleNote\": \"示例值\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "status": "示例值",
            "handleNote": "示例值"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/sentences/:id",
        "summary": "编辑题目",
        "permission": [
          "sentence:edit"
        ],
        "isPublic": false,
        "action": "题库管理 · 编辑题目",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "categoryId",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "",
            "example": 1
          },
          {
            "name": "sentenceEn",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "translationZh",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "ipa",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "scenePrompt",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "difficulty",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/sentences/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"categoryId\": 1,\n      \"sentenceEn\": \"示例值\",\n      \"translationZh\": \"示例值\",\n      \"ipa\": \"示例值\",\n      \"scenePrompt\": \"示例值\",\n      \"difficulty\": 1,\n      \"status\": \"示例值\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "categoryId": 1,
            "sentenceEn": "示例值",
            "translationZh": "示例值",
            "ipa": "示例值",
            "scenePrompt": "示例值",
            "difficulty": 1,
            "status": "示例值"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/sentences/categories/:id",
        "summary": "编辑分类",
        "permission": [
          "sentence:category"
        ],
        "isPublic": false,
        "action": "题库管理 · 编辑分类",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "name",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "分类名称（中文，唯一）",
            "example": "log-archive"
          },
          {
            "name": "nameEn",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "英文名（客户端卡片副标题）",
            "example": "示例值"
          },
          {
            "name": "icon",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "图标：**lucide 图标名**（不带前缀）。 Web 端拼 `i-lucide-*`、App 端查 `android/lib/theme/icon_map.dart`， 所以名字必须是 lucide 里真实存在的，否则 Web 端会画不出图标。",
            "example": "示例值"
          },
          {
            "name": "sort",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "排序（升序）",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "1 启用 / 0 禁用",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/sentences/categories/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"name\": \"log-archive\",\n      \"nameEn\": \"示例值\",\n      \"icon\": \"示例值\",\n      \"sort\": 1,\n      \"status\": 1\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "name": "log-archive",
            "nameEn": "示例值",
            "icon": "示例值",
            "sort": 1,
            "status": 1
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/sentences/:id",
        "summary": "下架题目（软删除）",
        "permission": [
          "sentence:remove"
        ],
        "isPublic": false,
        "action": "题库管理 · 下架题目",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/sentences/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/sentences/categories/:id",
        "summary": "删除分类（有题目引用时拒绝）",
        "permission": [
          "sentence:category"
        ],
        "isPublic": false,
        "action": "题库管理 · 删除分类",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/sentences/categories/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/sentences/gen-tasks/:id",
        "summary": "删除批次（保留已配图题目，只清理未生成配图的题目）",
        "permission": [
          "sentence:gen"
        ],
        "isPublic": false,
        "action": "题库管理 · 删除批次",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/sentences/gen-tasks/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "Analytics",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/analytics/ai-calls",
        "summary": "近 N 日 AI 调用统计",
        "permission": [
          "analytics:view"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/analytics/ai-calls?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/analytics/ai-logs",
        "summary": "AI 调用日志（分页）",
        "permission": [
          "analytics:view"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/analytics/ai-logs?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/analytics/ai-logs/summary",
        "summary": "AI 调用日志汇总（与列表同一套筛选）。 ⚠️ 必须声明在 `ai-logs` 之前不影响（两者都无参数段），但**必须在任何 `:param` 路由之前**",
        "permission": [
          "analytics:view"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/analytics/ai-logs/summary?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/analytics/answer-trend",
        "summary": "近 N 日答题趋势",
        "permission": [
          "analytics:view"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/analytics/answer-trend?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/analytics/category",
        "summary": "分类运营数据",
        "permission": [
          "analytics:view"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/analytics/category?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/analytics/checkin",
        "summary": "打卡统计",
        "permission": [
          "analytics:view"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/analytics/checkin?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/analytics/difficulty",
        "summary": "题目难度分布",
        "permission": [
          "analytics:view"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/analytics/difficulty?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/analytics/overview",
        "summary": "总览指标",
        "permission": [
          "analytics:view"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/analytics/overview?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      }
    ]
  },
  {
    "group": "Categories",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/categories",
        "summary": "启用中的分类（按 sort 升序）。游客可访问（首页展示用）",
        "permission": [],
        "isPublic": true,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/categories?page=1&pageSize=10\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      }
    ]
  },
  {
    "group": "Checkin",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/checkin/today",
        "summary": "今日进度",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/checkin/today?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/checkin",
        "summary": "打卡（幂等；返回海报数据）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/checkin\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      }
    ]
  },
  {
    "group": "ClientAi",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/ai/quota",
        "summary": "今日 AI 额度（前端展示「剩余 N 次」并在用尽前置灰按钮）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/ai/quota?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/ai/expand",
        "summary": "场景延展造句（SSE）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/ai/expand\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "isRawResponse": true
        }
      },
      {
        "method": "POST",
        "path": "/api/client/ai/word-root",
        "summary": "词根词缀拆解（SSE）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/ai/word-root\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "isRawResponse": true
        }
      }
    ]
  },
  {
    "group": "ClientAuth",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/auth/captcha",
        "summary": "图形验证码（登录/注册前拉取；关闭验证码时 enabled=false）",
        "permission": [],
        "isPublic": true,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/auth/captcha?page=1&pageSize=10\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/auth/me",
        "summary": "我的资料",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/auth/me?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/auth/avatar",
        "summary": "上传头像（单文件；自动替换旧头像并清理原文件）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/auth/avatar\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/client/auth/login",
        "summary": "登录",
        "permission": [],
        "isPublic": true,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/auth/login\""
        }
      },
      {
        "method": "POST",
        "path": "/api/client/auth/logout",
        "summary": "登出（服务端令旧令牌失效）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/auth/logout\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/client/auth/refresh",
        "summary": "刷新令牌",
        "permission": [],
        "isPublic": true,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/auth/refresh\""
        }
      },
      {
        "method": "POST",
        "path": "/api/client/auth/register",
        "summary": "注册",
        "permission": [],
        "isPublic": true,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/auth/register\""
        }
      },
      {
        "method": "PUT",
        "path": "/api/client/auth/me",
        "summary": "更新资料",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/client/auth/me\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "PUT",
        "path": "/api/client/auth/me/background",
        "summary": "设置个人主页背景句签（cardId=0 恢复默认渐变；仅限已获得的句签）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/client/auth/me/background\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "PUT",
        "path": "/api/client/auth/password",
        "summary": "修改密码",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/client/auth/password\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      }
    ]
  },
  {
    "group": "ClientNotice",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/notices",
        "summary": "我的通知列表（已发布；置顶优先，其次按发布时间倒序）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "noticeType",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "isRead",
            "in": "query",
            "type": "number",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/notices?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/notices/unread-count",
        "summary": "未读数（客户端红点）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/notices/unread-count?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/notices/:id/read",
        "summary": "标记单条已读（幂等，重复点不报错）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/notices/1/read\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/notices/read-all",
        "summary": "全部标记已读",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/notices/read-all\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      }
    ]
  },
  {
    "group": "Feedback",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/feedback/mine",
        "summary": "我的反馈（含处理状态与运营回复）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/feedback/mine?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/feedback",
        "summary": "提交产品反馈",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/feedback\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      }
    ]
  },
  {
    "group": "Gamify",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/gamify/overview",
        "summary": "成长概览（XP / 等级 / 成就 / 场景地图）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/gamify/overview?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      }
    ]
  },
  {
    "group": "Library",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/favorites",
        "summary": "收藏夹（分页）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/favorites?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/history",
        "summary": "学习记录（全量历史：全部/错题/对题 + 难度/场景/时间范围筛选）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "type",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/history?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/review",
        "summary": "复习池（分页：答错且到期的题）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/review?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      }
    ]
  },
  {
    "group": "Questions",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/questions/next",
        "summary": "下一张卡（8:2 新题/复习混抽；不含答案）。 difficulty 仅作用于新题抽取；拼词词块**恒定下发**，便于客户端切换作答模式时无需重抽题",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/questions/next?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/questions/:id/answer",
        "summary": "提交答案（返回正确答案，用于翻转面）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/questions/1/answer\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/questions/:id/favorite",
        "summary": "收藏 / 取消收藏",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/questions/1/favorite\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/client/questions/:id/favorite",
        "summary": "取消收藏（显式 DELETE，语义优先）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "id",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/client/questions/1/favorite\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "Report",
    "endpoints": [
      {
        "method": "POST",
        "path": "/api/client/report",
        "summary": "提交举报/反馈",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/report\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      }
    ]
  },
  {
    "group": "SentenceCard",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/sentence-card/mine",
        "summary": "我的句签列表（按获得时间倒序）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/sentence-card/mine?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/sentence-card/missing",
        "summary": "未拥有的句签（已就绪 − 已获得；含总数与最近一批）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/sentence-card/missing?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/sentence-card/today",
        "summary": "今日句签是否已获得（导航头像常驻特效用；轻量查询，不返回卡片内容）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/sentence-card/today?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/sentence-card/claim",
        "summary": "领取今日句签（完成每日目标且今日句签就绪时返回；否则 null）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/sentence-card/claim\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      }
    ]
  },
  {
    "group": "WordRoot",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/word-roots",
        "summary": "搜索词根词典（q 为空时返回热门词）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "page",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "页码，从 1 开始",
            "example": 1
          },
          {
            "name": "pageSize",
            "in": "query",
            "type": "integer",
            "required": false,
            "description": "每页条数",
            "example": 10
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/word-roots?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/word-roots/:word",
        "summary": "查词：命中缓存直接返回，未命中实时 AI 解析并入库。 缓存未命中会计一次 AI 额度（命中不扣）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "word",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/word-roots/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "word": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/word-roots",
        "summary": "收录词条：把「AI 词根拆解」的结果落库（词库已有则不覆盖，幂等）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/word-roots\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      }
    ]
  }
];
