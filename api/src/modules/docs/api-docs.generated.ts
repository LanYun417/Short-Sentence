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
    "group": "场景分类",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/categories",
        "summary": "启用中的**日常场景**分类（按 sort 升序），附各分类的可刷题数。 游客可访问（首页展示用）。 - **排除节日分类**：节日有专属题库接口（/client/questions/festivals）， 混进来会在题库页出现两份「元旦」。 - 题数一次 groupBy 拿全量再内存合并：分类就两位数，不值得每行发一条 count",
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
    "group": "成长管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/gamify/achievements",
        "summary": "成就列表（全部，含解锁人数）",
        "permission": [
          "sentence:gamify"
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
          "curl": "curl -X GET \"http://localhost:3000/api/gamify/achievements?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/gamify/stats",
        "summary": "成长统计总览",
        "permission": [
          "sentence:gamify"
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
          "curl": "curl -X GET \"http://localhost:3000/api/gamify/stats?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/gamify/xp-logs",
        "summary": "XP 账本分页审计（关键字匹配用户邮箱/昵称；可按事件类型、日期范围筛选）",
        "permission": [
          "sentence:gamify"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "eventType",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "dateFrom",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "dateTo",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "keyword",
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
          "curl": "curl -X GET \"http://localhost:3000/api/gamify/xp-logs?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/gamify/xp/grant",
        "summary": "手动补偿 XP（只加不减：amount 恒为正；绕过每日上限但走唯一 event_key 幂等）",
        "permission": [
          "sentence:gamify:handle"
        ],
        "isPublic": false,
        "action": "成长管理 · 手动补偿XP",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/gamify/xp/grant\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "PUT",
        "path": "/api/gamify/achievements/:code",
        "summary": "编辑成就展示字段（name/description/icon/category/rewardXp/sort；code 不可改）",
        "permission": [
          "sentence:gamify:edit"
        ],
        "isPublic": false,
        "action": "成长管理 · 编辑成就",
        "params": [
          {
            "name": "code",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/gamify/achievements/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "code": "1"
          }
        }
      }
    ]
  },
  {
    "group": "成长激励",
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
      },
      {
        "method": "GET",
        "path": "/api/client/gamify/weekly-report",
        "summary": "周学习报告（本周答题/正确率/活跃天数/经验/成就/连续打卡 + 每日明细 + 上周对比）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/gamify/weekly-report?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      }
    ]
  },
  {
    "group": "词根查询",
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
    "group": "打卡管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/checkins/records",
        "summary": "打卡记录分页审计（关键字 / 日期范围 / 是否完成）",
        "permission": [
          "sentence:checkin"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "dateFrom",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "dateTo",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "keyword",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "completed",
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
          "curl": "curl -X GET \"http://localhost:3000/api/checkins/records?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/checkins/stats",
        "summary": "近 N 天打卡日历统计（热力图）+ 今日汇总 + 启用用户总数",
        "permission": [
          "sentence:checkin"
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
          "curl": "curl -X GET \"http://localhost:3000/api/checkins/stats?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/checkins/backfill",
        "summary": "补签：把某天 doneCount 补到目标值并重算连续天数（幂等）",
        "permission": [
          "sentence:checkin:handle"
        ],
        "isPublic": false,
        "action": "打卡管理 · 补签",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/checkins/backfill\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/checkins/revoke",
        "summary": "撤销某天打卡（幂等；删行后重算连续天数）",
        "permission": [
          "sentence:checkin:handle"
        ],
        "isPublic": false,
        "action": "打卡管理 · 撤销打卡",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/checkins/revoke\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      }
    ]
  },
  {
    "group": "句签",
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
    "group": "客户端公告",
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
    "group": "客户端认证",
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
        "method": "GET",
        "path": "/api/client/auth/me/export",
        "summary": "导出本人全部个人数据（JSON 附件下载；账号注销合规 / 商店审核用）。 通过 @RawResponse 跳过统一响应体包装，直接以附件形式下发 JSON",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/auth/me/export\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "isRawResponse": true
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
        "path": "/api/client/auth/code-login",
        "summary": "邮箱验证码登录（先调 `/client/auth/email-code`（purpose=login）发送验证码）",
        "permission": [],
        "isPublic": true,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/auth/code-login\""
        }
      },
      {
        "method": "POST",
        "path": "/api/client/auth/deletion-code",
        "summary": "发送注销验证码（只发给当前登录用户本人的邮箱）。 与公开的 `email-code` 分开：注销验证码不能允许给任意邮箱发",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/auth/deletion-code\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/client/auth/email-code",
        "summary": "发送邮箱验证码（注册/登录/重置密码；同邮箱同用途 60 秒只能发一次）",
        "permission": [],
        "isPublic": true,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/auth/email-code\""
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
        "method": "POST",
        "path": "/api/client/auth/wechat",
        "summary": "微信小程序登录（wx.login 的 code → 我们自己的 JWT 双 token）。 复用与邮箱登录完全相同的令牌体系，小程序后续所有 /api/client/* 接口通用",
        "permission": [],
        "isPublic": true,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/auth/wechat\""
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
      },
      {
        "method": "DELETE",
        "path": "/api/client/auth/me",
        "summary": "注销账号（软删：令牌失效 + 身份匿名化 + 清空微信绑定 + 清除学习历史）。 **需二次身份校验**：邮箱账号传 emailCode（先调 `deletion-code`）， 微信账号传 wechatCode（wx.login 的 code），两者都不传会被拒。 注销后原邮箱可重新注册；原微信因 openid 已解绑，再登录将生成全新账号",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/client/auth/me\" \\\n  -H \"Authorization: Bearer <accessToken>\""
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
    "group": "客户端应用",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/app/download/:id",
        "summary": "下载安装包（游客可访问；每次下载计一次数）",
        "permission": [],
        "isPublic": true,
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/app/download/1\"",
          "pathParams": {
            "id": "1"
          },
          "isRawResponse": true
        }
      },
      {
        "method": "GET",
        "path": "/api/client/app/latest",
        "summary": "最新上架版本（游客可访问：下载页不需要登录）。空 = 尚未发布",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/app/latest?page=1&pageSize=10\"",
          "query": {
            "page": 1,
            "pageSize": 10
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
        "path": "/api/client-users/:id/sentence-cards/missing",
        "summary": "未拥有的句签（已就绪 − 已获得；total + 最近一批，供详情弹窗「未拥有」区展示）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client-users/1/sentence-cards/missing\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client-users/deletions",
        "summary": "账号注销记录（分页 + 原因分布）。 **必须声明在 `@Get(':id')` 之前**：Nest 按声明顺序注册路由， `/client-users/deletions` 若排在 `:id` 之后会先命中详情并被参数校验拒掉",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client-users/deletions?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client-users/export",
        "summary": "导出客户端用户 CSV（流式；筛选与列表共用同一套条件）。 **必须声明在 `@Get(':id')` 之前**。此前它排在下面，请求先命中 `:id`， 被 `IdParamDto` 判为「id 必须为正整数」→ 后台「导出」按钮一直是 400。 所有**单段**固定路径（deletions / export）都要放在 `:id` 之前",
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
        "method": "POST",
        "path": "/api/client-users/:id/sentence-cards/grant",
        "summary": "一键解锁指定句签（幂等；重复解锁返回 alreadyOwned=true）",
        "permission": [
          "client:user:edit"
        ],
        "isPublic": false,
        "action": "客户端用户 · 解锁句签",
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
          "curl": "curl -X POST \"http://localhost:3000/api/client-users/1/sentence-cards/grant\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
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
    "group": "每日打卡",
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
    "group": "情景闯关",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/stages",
        "summary": "关卡总览（剧本分组 + 关卡 + 参与/通关/领奖统计）",
        "permission": [
          "stage:view"
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
          "curl": "curl -X GET \"http://localhost:3000/api/stages?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/stages/scripts",
        "summary": "剧本列表（含停用的，附场景名/封面/关卡数与统计）",
        "permission": [
          "stage:view"
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
          "curl": "curl -X GET \"http://localhost:3000/api/stages/scripts?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/stages/sessions",
        "summary": "对话会话分页列表（筛选：storyId / status / userId / noTranslation / keyword=昵称）",
        "permission": [
          "stage:view"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "categoryId",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "userId",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "noTranslation",
            "in": "query",
            "type": "unknown",
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
          "curl": "curl -X GET \"http://localhost:3000/api/stages/sessions?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/stages/sessions/:id",
        "summary": "会话详情：完整消息流，用于抽查 AI 质量与客诉",
        "permission": [
          "stage:view"
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
          "curl": "curl -X GET \"http://localhost:3000/api/stages/sessions/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/stages/stories",
        "summary": "关卡列表（含停用的，带剧本/场景与统计）",
        "permission": [
          "stage:view"
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
          "curl": "curl -X GET \"http://localhost:3000/api/stages/stories?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/stages/scripts",
        "summary": "新增剧本（挂在某个场景下）",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · 新增剧本",
        "params": [
          {
            "name": "categoryId",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "场景分类 id（sentence_category.id）",
            "example": 1
          },
          {
            "name": "name",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "log-archive"
          },
          {
            "name": "blurb",
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
            "name": "status",
            "in": "body",
            "type": "0 | 1",
            "required": false,
            "description": "",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/stages/scripts\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"categoryId\": 1,\n      \"name\": \"log-archive\",\n      \"blurb\": \"示例值\",\n      \"sort\": 1,\n      \"status\": \"示例值\"\n    }'",
          "requestBody": {
            "categoryId": 1,
            "name": "log-archive",
            "blurb": "示例值",
            "sort": 1,
            "status": "示例值"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/stages/scripts/:id/cover",
        "summary": "生成剧本封面（AI 生图 → webp 入库 → 回写 cover_file_id）。 scriptId 必填；regenerate=true 时强制重生成",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · 生成剧本封面",
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
            "name": "regenerate",
            "in": "body",
            "type": "boolean",
            "required": false,
            "description": "为 true 时即使已有封面也强制重生成",
            "example": true
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/stages/scripts/1/cover\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"regenerate\": true\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "regenerate": true
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/stages/scripts/:id/status",
        "summary": "启停剧本（停用后整条剧本线客户端不可见，历史保留）",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · 启停剧本",
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
            "type": "0 | 1",
            "required": true,
            "description": "",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/stages/scripts/1/status\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"status\": \"示例值\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "status": "示例值"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/stages/scripts/covers/generate-missing",
        "summary": "补齐缺失封面的静态路由，必须声明在 scripts/:id 之前",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · 补全剧本封面",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/stages/scripts/covers/generate-missing\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/stages/scripts/covers/regenerate-all",
        "summary": "批量重新生成全部启用剧本的封面（覆盖已有图；静态路由，同样必须声明在 scripts/:id 之前）",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · 批量重生剧本封面",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/stages/scripts/covers/regenerate-all\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/stages/sessions/:id/close",
        "summary": "强制结束进行中的会话（不改通关与进度，只把 active 置为 ended）",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · 强制结束会话",
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
          "curl": "curl -X POST \"http://localhost:3000/api/stages/sessions/1/close\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/stages/stories",
        "summary": "新增关卡（挂到某个剧本下）",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · 新增关卡",
        "params": [
          {
            "name": "scriptId",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "所属剧本 id（stage_script.id）",
            "example": 1
          },
          {
            "name": "title",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "intro",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "outro",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "userRole",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "setting",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "goal",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "minTurns",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "",
            "example": 1
          },
          {
            "name": "maxTurns",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "",
            "example": 1
          },
          {
            "name": "target",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "rewardXp",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "",
            "example": 1
          },
          {
            "name": "roles",
            "in": "body",
            "type": "StageRoleDto[]",
            "required": true,
            "description": "",
            "example": [
              {
                "nameEn": "示例值",
                "name": "log-archive",
                "persona": "示例值",
                "emoji": "示例值"
              }
            ]
          },
          {
            "name": "opening",
            "in": "body",
            "type": "StageLineDto[]",
            "required": true,
            "description": "",
            "example": [
              {
                "speaker": "示例值",
                "contentEn": "示例值",
                "contentZh": "示例值"
              }
            ]
          },
          {
            "name": "starterHints",
            "in": "body",
            "type": "StageHintDto[]",
            "required": true,
            "description": "",
            "example": [
              {
                "en": "示例值",
                "zh": "示例值"
              }
            ]
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/stages/stories\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"scriptId\": 1,\n      \"title\": \"示例值\",\n      \"intro\": \"示例值\",\n      \"outro\": \"示例值\",\n      \"userRole\": \"示例值\",\n      \"setting\": \"示例值\",\n      \"goal\": \"示例值\",\n      \"minTurns\": 1,\n      \"maxTurns\": 1,\n      \"target\": 1,\n      \"rewardXp\": 1,\n      \"roles\": [],\n      \"opening\": [],\n      \"starterHints\": []\n    }'",
          "requestBody": {
            "scriptId": 1,
            "title": "示例值",
            "intro": "示例值",
            "outro": "示例值",
            "userRole": "示例值",
            "setting": "示例值",
            "goal": "示例值",
            "minTurns": 1,
            "maxTurns": 1,
            "target": 1,
            "rewardXp": 1,
            "roles": [],
            "opening": [],
            "starterHints": []
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/stages/stories/:id/status",
        "summary": "启停关卡（停用后客户端不可见，历史保留）",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · 启停关卡",
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
            "type": "0 | 1",
            "required": true,
            "description": "",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/stages/stories/1/status\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"status\": \"示例值\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "status": "示例值"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/stages/stories/ai-generate",
        "summary": "AI 生成关卡草稿（静态路由）。不落库：返回整套剧情草稿，运营在编辑弹窗审核后再保存",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · AI 生成关卡草稿",
        "params": [
          {
            "name": "scriptId",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/stages/stories/ai-generate\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"scriptId\": 1\n    }'",
          "requestBody": {
            "scriptId": 1
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/stages/stories/reorder",
        "summary": "剧本内重排序（静态路由，必须声明在 stories/:id 之前）",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · 调整关卡顺序",
        "params": [
          {
            "name": "scriptId",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "",
            "example": 1
          },
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
          "curl": "curl -X POST \"http://localhost:3000/api/stages/stories/reorder\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"scriptId\": 1,\n      \"ids\": []\n    }'",
          "requestBody": {
            "scriptId": 1,
            "ids": []
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/stages/scripts/:id",
        "summary": "编辑剧本（改名/简介/排序/换场景/启停）",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · 编辑剧本",
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
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "name",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "log-archive"
          },
          {
            "name": "blurb",
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
            "name": "status",
            "in": "body",
            "type": "0 | 1",
            "required": false,
            "description": "",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/stages/scripts/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"categoryId\": 1,\n      \"name\": \"log-archive\",\n      \"blurb\": \"示例值\",\n      \"sort\": 1,\n      \"status\": \"示例值\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "categoryId": 1,
            "name": "log-archive",
            "blurb": "示例值",
            "sort": 1,
            "status": "示例值"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/stages/stories/:id",
        "summary": "编辑关卡（允许换剧本）",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · 编辑关卡",
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
            "name": "scriptId",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
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
            "name": "intro",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "outro",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "userRole",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "setting",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "goal",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "minTurns",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "maxTurns",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "target",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "rewardXp",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "roles",
            "in": "body",
            "type": "StageRoleDto[]",
            "required": false,
            "description": "",
            "example": [
              {
                "nameEn": "示例值",
                "name": "log-archive",
                "persona": "示例值",
                "emoji": "示例值"
              }
            ]
          },
          {
            "name": "opening",
            "in": "body",
            "type": "StageLineDto[]",
            "required": false,
            "description": "",
            "example": [
              {
                "speaker": "示例值",
                "contentEn": "示例值",
                "contentZh": "示例值"
              }
            ]
          },
          {
            "name": "starterHints",
            "in": "body",
            "type": "StageHintDto[]",
            "required": false,
            "description": "",
            "example": [
              {
                "en": "示例值",
                "zh": "示例值"
              }
            ]
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/stages/stories/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"scriptId\": 1,\n      \"title\": \"示例值\",\n      \"intro\": \"示例值\",\n      \"outro\": \"示例值\",\n      \"userRole\": \"示例值\",\n      \"setting\": \"示例值\",\n      \"goal\": \"示例值\",\n      \"minTurns\": 1,\n      \"maxTurns\": 1,\n      \"target\": 1,\n      \"rewardXp\": 1,\n      \"roles\": [],\n      \"opening\": [],\n      \"starterHints\": []\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "scriptId": 1,
            "title": "示例值",
            "intro": "示例值",
            "outro": "示例值",
            "userRole": "示例值",
            "setting": "示例值",
            "goal": "示例值",
            "minTurns": 1,
            "maxTurns": 1,
            "target": 1,
            "rewardXp": 1,
            "roles": [],
            "opening": [],
            "starterHints": []
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/stages/scripts/:id",
        "summary": "删除剧本（连同其下关卡一起删；进度/会话按 storyId 保留）",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · 删除剧本",
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
          "curl": "curl -X DELETE \"http://localhost:3000/api/stages/scripts/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/stages/stories/:id",
        "summary": "删除关卡（物理删除；进度/会话按 storyId 保留）",
        "permission": [
          "stage:handle"
        ],
        "isPublic": false,
        "action": "情景闯关 · 删除关卡",
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
          "curl": "curl -X DELETE \"http://localhost:3000/api/stages/stories/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "数据分析",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/analytics/active-trend",
        "summary": "新增 / 日活趋势",
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
          "curl": "curl -X GET \"http://localhost:3000/api/analytics/active-trend?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/analytics/ai-budget",
        "summary": "今日 AI 预算状态（跨所有调用方的成本闸门）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/analytics/ai-budget?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
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
        "path": "/api/analytics/funnel",
        "summary": "留存漏斗（窗口内注册用户：注册 → 激活 → 打卡 → 领句签）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/analytics/funnel?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
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
      },
      {
        "method": "GET",
        "path": "/api/analytics/retention",
        "summary": "队列留存（按注册日的 D0/D1/D3/D7）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/analytics/retention?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      }
    ]
  },
  {
    "group": "刷题",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/questions/boss",
        "summary": "每日 Boss（当天固定一道挑战题，答对 +30 经验，一天一次）。 ⚠️ 必须声明在 `@Post(':id/answer')` 之前语义才清晰；Nest 按方法+路径匹配， `boss` 与 `:id` 不会冲突（GET 无 :id 路由），这里仍放前面便于阅读",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/questions/boss?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/questions/festivals",
        "summary": "可选的节日题库列表（只含有就绪题目的节日；按节日日期倒序）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/questions/festivals?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/questions/memory-stats",
        "summary": "记忆健康概览（遗忘曲线 / 待复习分布可视化）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/questions/memory-stats?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/questions/next",
        "summary": "下一张卡（8:2 新题/复习混抽；不含答案）。 difficulty 仅作用于新题抽取；festival / categoryId 传了则只从对应题库抽（专门刷题， 两者互斥、festival 优先）。拼词词块**恒定下发**，便于客户端切换作答模式时无需重抽题",
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
        "method": "POST",
        "path": "/api/client/questions/boss/answer",
        "summary": "提交 Boss 答案（判分复用刷题口径，额外发通关经验）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/questions/boss/answer\" \\\n  -H \"Authorization: Bearer <accessToken>\""
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
    "group": "题库管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/chains",
        "summary": "分页列表（按举报数倒序，优先暴露有问题的条目）",
        "permission": [
          "sentence:chain"
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
            "name": "status",
            "in": "query",
            "type": "string",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "topicId",
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
          "curl": "curl -X GET \"http://localhost:3000/api/chains?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/chains/topics",
        "summary": "主题下拉选项（条目筛选用，只列启用的）",
        "permission": [
          "sentence:chain"
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
          "curl": "curl -X GET \"http://localhost:3000/api/chains/topics?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/chains/topics/all",
        "summary": "主题管理列表：全部主题（含往期已停用批次），后台可见历史",
        "permission": [
          "sentence:chain"
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
          "curl": "curl -X GET \"http://localhost:3000/api/chains/topics/all?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
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
        "path": "/api/sentences/categories/cover-logs",
        "summary": "封面生成日志（分页）：「场景分类」页「生图日志」抽屉的数据来源",
        "permission": [
          "sentence:category"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "status",
            "in": "query",
            "type": "unknown",
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
          "curl": "curl -X GET \"http://localhost:3000/api/sentences/categories/cover-logs?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
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
            "name": "explanation",
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
          "curl": "curl -X POST \"http://localhost:3000/api/sentences\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"categoryId\": 1,\n      \"sentenceEn\": \"示例值\",\n      \"translationZh\": \"示例值\",\n      \"ipa\": \"示例值\",\n      \"explanation\": \"示例值\",\n      \"scenePrompt\": \"示例值\",\n      \"difficulty\": 1,\n      \"status\": \"示例值\"\n    }'",
          "requestBody": {
            "categoryId": 1,
            "sentenceEn": "示例值",
            "translationZh": "示例值",
            "ipa": "示例值",
            "explanation": "示例值",
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
        "path": "/api/sentences/categories/:id/cover",
        "summary": "生成（或重新生成）某场景的封面图：生图 → 审核 → 回写分类封面",
        "permission": [
          "sentence:category"
        ],
        "isPublic": false,
        "action": "题库管理 · 生成场景封面",
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
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/categories/1/cover\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/categories/covers/generate-missing",
        "summary": "一键补齐缺失的场景封面（AI 生图）。**静态路由，必须声明在 `categories/:id/cover` 之前**， 否则 `covers/generate-missing` 会被 `:id` 吃掉（Nest 按声明顺序匹配）",
        "permission": [
          "sentence:category"
        ],
        "isPublic": false,
        "action": "题库管理 · 补全场景封面",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/categories/covers/generate-missing\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/categories/covers/regenerate-all",
        "summary": "批量重新生成全部启用分类的封面（覆盖已有图，消耗较多 AI 生图配额）。 **静态路由，同样必须声明在 `categories/:id/cover` 之前**，否则会被 `:id` 吃掉",
        "permission": [
          "sentence:category"
        ],
        "isPublic": false,
        "action": "题库管理 · 批量重生场景封面",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/categories/covers/regenerate-all\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/explanation/backfill",
        "summary": "补全存量题解析（管理端手动、按批）。 为什么不用定时任务自动跑：现存题量上千，全量补一遍要花不少 token； 该花多少、什么时候花应由运营决定。每批返回 scanned/updated/remaining， 运营看着 remaining 点到 0 即可",
        "permission": [
          "sentence:gen"
        ],
        "isPublic": false,
        "action": "题库管理 · 补全解析",
        "params": [
          {
            "name": "limit",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "本批补多少条（缺省 20，上限 100）。 上限刻意压得低：一次补太多会长时间占用上游配额并逼近请求超时， 分批点几次更可控，接口每次都返回剩余条数。",
            "example": 1
          },
          {
            "name": "force",
            "in": "body",
            "type": "boolean",
            "required": false,
            "description": "是否重新生成已有解析（缺省 false）。 true = 把「不是新三行格式」的旧解析也重新生成（空值 + 旧的冗长解析）， 用于把历史内容统一精简成固定格式；补完即收敛，可反复点到 remaining=0。",
            "example": true
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/explanation/backfill\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"limit\": 1,\n      \"force\": true\n    }'",
          "requestBody": {
            "limit": 1,
            "force": true
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
        "summary": "手动触发批量生成（异步执行，进度看批次列表）。 传 difficulty 则本批全部出该难度（定向补某一档）；传 categoryName 则本批全部归属该场景 （定向填某一场景）。两者都省略则按自然分布跨所有启用分类",
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
          },
          {
            "name": "categoryName",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "定向补的场景分类名（中文，须为启用分类；省略则按自然分布跨所有启用分类）。 用于把某个 0 题的新场景填起来：本批所有题强制归属该分类，模型自报的分类名会被服务端覆盖。",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/gen/batch\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"count\": 1,\n      \"difficulty\": 1,\n      \"categoryName\": \"示例值\"\n    }'",
          "requestBody": {
            "count": 1,
            "difficulty": 1,
            "categoryName": "示例值"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/gen/festival",
        "summary": "手动触发「今天的节日题库」（运营补跑 / 测试用；非节日返回 400）。 与定时任务同一条链路：新一期生成成功后，同一节日的旧题整体退场",
        "permission": [
          "sentence:gen"
        ],
        "isPublic": false,
        "action": "题库管理 · 触发节日题库",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/gen/festival\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/gen/festival-covers",
        "summary": "为全年所有节日生成**专属封面图**。 与「生成节日题库」一样是**即发即忘**：二十来张图串行生成要十几分钟， 管理端 axios 超时只有 15 秒，同步返回必然超时。所以立即返回「已启动」， 进度通过题库页的封面出没来判断。 已有封面的节日默认跳过（不覆盖）；force=true 时强制重画（换掉不贴合的封面）",
        "permission": [
          "sentence:gen"
        ],
        "isPublic": false,
        "action": "题库管理 · 生成节日封面",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/gen/festival-covers\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/gen/festivals",
        "summary": "手动触发「全部节日题库」的一次性生成（首次铺库 / 换年后补齐）。 节日题库是**常驻内容库**：一次铺满全年所有节日，用户端随时都能看到 所有节日并专门刷题，而不是只有节日当天才有题可选。 只补题量不足的节日，已就绪的会跳过（不重生成，免得把用户正在刷的题换掉）",
        "permission": [
          "sentence:gen"
        ],
        "isPublic": false,
        "action": "题库管理 · 生成全部节日题库",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/gen/festivals\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/sentences/word-meanings/backfill",
        "summary": "补全存量题逐词释义（管理端手动、按批；拼词模式悬浮词义用）。 与解析回填同一取舍：全量补一遍要花不少 token，由运营决定什么时候花、花多少。 默认补「还没有词义」的题；force=true 重生成「已有词义」的题（模型升级后刷新口径）。 每批返回 scanned/updated/remaining（remaining 恒为「缺词义」的题数，便于点到 0）",
        "permission": [
          "sentence:gen"
        ],
        "isPublic": false,
        "action": "题库管理 · 逐词释义回填",
        "params": [
          {
            "name": "limit",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "本批补多少条（缺省 20，上限 100）。 上限刻意压得低：一次补太多会长时间占用上游配额并逼近请求超时， 分批点几次更可控，接口每次都返回剩余条数。",
            "example": 1
          },
          {
            "name": "force",
            "in": "body",
            "type": "boolean",
            "required": false,
            "description": "是否重新生成已有词义（缺省 false）。 true = 连已生成过释义的题一起重新生成（用于模型升级后统一刷新口径）， 可反复点到 remaining=0。",
            "example": true
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/sentences/word-meanings/backfill\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"limit\": 1,\n      \"force\": true\n    }'",
          "requestBody": {
            "limit": 1,
            "force": true
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/chains/:id/status",
        "summary": "通过 / 拒绝 / 隐藏一条接龙",
        "permission": [
          "sentence:chain:handle"
        ],
        "isPublic": false,
        "action": "题库管理 · 审核接龙",
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
            "type": "'visible' | 'hidden' | 'rejected'",
            "required": true,
            "description": "visible 通过 / rejected 拒绝 / hidden 隐藏",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/chains/1/status\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"status\": \"示例值\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "status": "示例值"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/chains/topics/:id/status",
        "summary": "启用 / 停用一个主题（停用后客户端不再展示，仅后台可见）",
        "permission": [
          "sentence:chain:handle"
        ],
        "isPublic": false,
        "action": "题库管理 · 启停接龙主题",
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
            "type": "0 | 1",
            "required": true,
            "description": "1 启用 / 0 停用",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/chains/topics/1/status\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"status\": \"示例值\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "status": "示例值"
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
            "name": "explanation",
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
          "curl": "curl -X PUT \"http://localhost:3000/api/sentences/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"categoryId\": 1,\n      \"sentenceEn\": \"示例值\",\n      \"translationZh\": \"示例值\",\n      \"ipa\": \"示例值\",\n      \"explanation\": \"示例值\",\n      \"scenePrompt\": \"示例值\",\n      \"difficulty\": 1,\n      \"status\": \"示例值\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "categoryId": 1,
            "sentenceEn": "示例值",
            "translationZh": "示例值",
            "ipa": "示例值",
            "explanation": "示例值",
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
        "path": "/api/chains/:id",
        "summary": "删除一条接龙（级联清点赞与举报记录）",
        "permission": [
          "sentence:chain:handle"
        ],
        "isPublic": false,
        "action": "题库管理 · 删除接龙",
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
          "curl": "curl -X DELETE \"http://localhost:3000/api/chains/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
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
        "summary": "删除批次（保留已配图题目，只清理未生成配图的题目；运行中的批次会在当前批次边界停下）",
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
    "group": "题目举报",
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
    "group": "学习小队",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/teams",
        "summary": "小队分页列表（筛选：status / keyword=队名 / minMembers）",
        "permission": [
          "team:view"
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
            "name": "minMembers",
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
          "curl": "curl -X GET \"http://localhost:3000/api/teams?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/teams/:id",
        "summary": "小队详情：成员 + 今日打卡状态",
        "permission": [
          "team:view"
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
          "curl": "curl -X GET \"http://localhost:3000/api/teams/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/teams/:id/messages",
        "summary": "小队群聊消息分页（含已隐藏，供审核）",
        "permission": [
          "team:view"
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
          "curl": "curl -X GET \"http://localhost:3000/api/teams/1/messages\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/teams/stats",
        "summary": "概览统计（进行中/已解散小队数、在队用户数、今日全员达成数）",
        "permission": [
          "team:view"
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
          "curl": "curl -X GET \"http://localhost:3000/api/teams/stats?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/teams/:id/dissolve",
        "summary": "解散小队（清空成员，成员可重新匹配）",
        "permission": [
          "team:handle"
        ],
        "isPublic": false,
        "action": "学习小队 · 解散小队",
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
          "curl": "curl -X POST \"http://localhost:3000/api/teams/1/dissolve\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/teams/:id/name",
        "summary": "运营改名（修正不当队名）",
        "permission": [
          "team:handle"
        ],
        "isPublic": false,
        "action": "学习小队 · 修改小队名",
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
            "description": "新小队名（service 会去空白、压缩连续空格，并按码点校验 2~20 字）",
            "example": "log-archive"
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/teams/1/name\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"name\": \"log-archive\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "name": "log-archive"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/teams/messages/:id/status",
        "summary": "隐藏 / 恢复一条群聊消息",
        "permission": [
          "team:handle"
        ],
        "isPublic": false,
        "action": "学习小队 · 审核群聊消息",
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
          "curl": "curl -X PUT \"http://localhost:3000/api/teams/messages/1/status\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "音标管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/ipa/phonemes",
        "summary": "音标分页列表（带学会人数；支持关键字 / 类型筛选）",
        "permission": [
          "sentence:ipa"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "type",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "keyword",
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
          "curl": "curl -X GET \"http://localhost:3000/api/ipa/phonemes?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/ipa/records",
        "summary": "学习记录分页审计（关键字匹配音标或用户）",
        "permission": [
          "sentence:ipa"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "keyword",
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
          "curl": "curl -X GET \"http://localhost:3000/api/ipa/records?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/ipa/stats",
        "summary": "学习统计总览（totals + 近 7 天趋势 + 学会人数 Top5）",
        "permission": [
          "sentence:ipa"
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
          "curl": "curl -X GET \"http://localhost:3000/api/ipa/stats?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/ipa/phonemes/reset-seeds",
        "summary": "按内置种子重置全部音标内容（覆盖手动修改；必须声明在 :id 之前——同为 phonemes 前缀但方法不同，仍显式前置）",
        "permission": [
          "sentence:ipa:handle"
        ],
        "isPublic": false,
        "action": "音标管理 · 重置音标种子",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/ipa/phonemes/reset-seeds\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "PUT",
        "path": "/api/ipa/phonemes/:id",
        "summary": "编辑音标内容字段（symbol 不可改，见 DTO 注释）",
        "permission": [
          "sentence:ipa:edit"
        ],
        "isPublic": false,
        "action": "音标管理 · 编辑音标",
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
          "curl": "curl -X PUT \"http://localhost:3000/api/ipa/phonemes/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "用户反馈",
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
        "summary": "提交产品反馈（文本 + 最多 5 张图片，multipart）",
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
    "group": "邮件设置",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/mail-settings",
        "summary": "读取设置（密钥只回掩码）",
        "permission": [
          "system:mail:list"
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
          "curl": "curl -X GET \"http://localhost:3000/api/mail-settings?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/mail-settings/test",
        "summary": "发送测试邮件（用验证码模板发一条，验证凭证/模板/域名是否都配好）",
        "permission": [
          "system:mail:edit"
        ],
        "isPublic": false,
        "action": "邮件设置 · 测试发信",
        "params": [
          {
            "name": "to",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/mail-settings/test\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"to\": \"示例值\"\n    }'",
          "requestBody": {
            "to": "示例值"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/mail-settings",
        "summary": "保存设置（secretKey 传空 = 不修改）",
        "permission": [
          "system:mail:edit"
        ],
        "isPublic": false,
        "action": "邮件设置 · 保存",
        "params": [
          {
            "name": "enabled",
            "in": "body",
            "type": "boolean",
            "required": true,
            "description": "总开关",
            "example": true
          },
          {
            "name": "secretId",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "secretKey",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "留空 = 保持原密钥不变",
            "example": "示例值"
          },
          {
            "name": "region",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "fromAddress",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "fromAlias",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "templateCaptcha",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          },
          {
            "name": "templateReminder",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/mail-settings\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"enabled\": true,\n      \"secretId\": \"示例值\",\n      \"secretKey\": \"示例值\",\n      \"region\": \"示例值\",\n      \"fromAddress\": \"示例值\",\n      \"fromAlias\": \"示例值\",\n      \"templateCaptcha\": 1,\n      \"templateReminder\": 1\n    }'",
          "requestBody": {
            "enabled": true,
            "secretId": "示例值",
            "secretKey": "示例值",
            "region": "示例值",
            "fromAddress": "示例值",
            "fromAlias": "示例值",
            "templateCaptcha": 1,
            "templateReminder": 1
          }
        }
      }
    ]
  },
  {
    "group": "语句库",
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
            "name": "kind",
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
    "group": "支付订单",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/pay/orders",
        "summary": "订单列表（分页；可按状态/渠道/用户/订单号/交易号/日期筛选）",
        "permission": [
          "pay:order:query"
        ],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "status",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "channel",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "userId",
            "in": "query",
            "type": "number",
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
            "name": "dateFrom",
            "in": "query",
            "type": "unknown",
            "required": false,
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "dateTo",
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
          "curl": "curl -X GET \"http://localhost:3000/api/pay/orders?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/pay/orders/skus",
        "summary": "会员套餐列表（含下架项；后台只读，改价走数据库种子约定）",
        "permission": [
          "pay:order:query"
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
          "curl": "curl -X GET \"http://localhost:3000/api/pay/orders/skus?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/pay/orders/stats",
        "summary": "收入概览（累计/今日/有效会员/待支付）",
        "permission": [
          "pay:order:query"
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
          "curl": "curl -X GET \"http://localhost:3000/api/pay/orders/stats?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/pay/orders/:orderNo/refund",
        "summary": "全额退款（微信受理即返回；订单置已退款并撤销该笔权益）",
        "permission": [
          "pay:order:refund"
        ],
        "isPublic": false,
        "action": "支付订单 · 退款",
        "params": [
          {
            "name": "orderNo",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/pay/orders/1/refund\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "orderNo": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/pay/orders/:orderNo/sync",
        "summary": "手动同步订单（回调丢失时向微信查单补单）",
        "permission": [
          "pay:order:edit"
        ],
        "isPublic": false,
        "action": "支付订单 · 同步订单",
        "params": [
          {
            "name": "orderNo",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/pay/orders/1/sync\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "orderNo": "1"
          }
        }
      }
    ]
  },
  {
    "group": "支付设置",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/pay/settings",
        "summary": "读取微信支付配置（密钥只回掩码；附带缺项提示）",
        "permission": [
          "pay:settings:query"
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
          "curl": "curl -X GET \"http://localhost:3000/api/pay/settings?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/pay/settings",
        "summary": "保存微信支付配置（整表提交；保存后立即生效，无需重启）",
        "permission": [
          "pay:settings:edit"
        ],
        "isPublic": false,
        "action": "支付设置 · 保存配置",
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/pay/settings\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      }
    ]
  },
  {
    "group": "AI 设置",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/ai-settings",
        "summary": "读取设置（API Key 只回掩码）",
        "permission": [
          "system:ai:list"
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
          "curl": "curl -X GET \"http://localhost:3000/api/ai-settings?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/ai-settings/test",
        "summary": "测试连通性：用指定的模型（未保存的草稿或已存的 id）发一个极短请求。 不传参时测当前生效的生文模型。失败时把上游状态码与前 200 字回包透出，便于定位",
        "permission": [
          "system:ai:edit"
        ],
        "isPublic": false,
        "action": "AI 设置 · 测试连通性",
        "params": [
          {
            "name": "model",
            "in": "body",
            "type": "SaveAiModelDto",
            "required": false,
            "description": "",
            "example": {
              "id": "示例值",
              "purpose": "示例值",
              "enabled": true,
              "format": "示例值",
              "fullUrl": true,
              "baseUrl": "示例值",
              "modelId": "示例值",
              "modelLabel": "示例值",
              "apiKey": "示例值",
              "advanced": "示例值"
            }
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/ai-settings/test\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"model\": \"示例值\"\n    }'",
          "requestBody": {
            "model": "示例值"
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/ai-settings",
        "summary": "保存设置（整表提交）。 每项的 apiKey 留空 = 沿用已存密钥（匹配同 id 的旧值），避免前端把掩码回填成真值",
        "permission": [
          "system:ai:edit"
        ],
        "isPublic": false,
        "action": "AI 设置 · 保存",
        "params": [
          {
            "name": "models",
            "in": "body",
            "type": "SaveAiModelDto[]",
            "required": true,
            "description": "",
            "example": [
              {
                "id": "示例值",
                "purpose": "示例值",
                "enabled": true,
                "format": "示例值",
                "fullUrl": true,
                "baseUrl": "示例值",
                "modelId": "示例值",
                "modelLabel": "示例值",
                "apiKey": "示例值",
                "advanced": "示例值"
              }
            ]
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/ai-settings\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"models\": []\n    }'",
          "requestBody": {
            "models": []
          }
        }
      }
    ]
  },
  {
    "group": "AI 拓展",
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
        "path": "/api/client/ai/analyze",
        "summary": "题目解析：答题后无论对错都给出语法与关键词形态的讲解（SSE）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/ai/analyze\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "isRawResponse": true
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
    "group": "App 版本",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/app-versions",
        "summary": "分页列表（筛选 platform / status / keyword）",
        "permission": [
          "system:app-version:list"
        ],
        "isPublic": false,
        "action": "",
        "params": [
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
          "curl": "curl -X GET \"http://localhost:3000/api/app-versions?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/app-versions",
        "summary": "新增版本",
        "permission": [
          "system:app-version:add"
        ],
        "isPublic": false,
        "action": "App 版本 · 新增",
        "params": [
          {
            "name": "platform",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "平台（当前只做 android；ios 预留）",
            "example": "示例值"
          },
          {
            "name": "version",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "版本名（展示用，如 1.2.0）",
            "example": "示例值"
          },
          {
            "name": "versionCode",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "版本序号（Android versionCode，越大越新）",
            "example": 1
          },
          {
            "name": "fileId",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "安装包文件 id（先调专用上传接口拿到）",
            "example": 1
          },
          {
            "name": "fileSize",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "安装包大小（字节；不传则由文件记录兜底）",
            "example": 1
          },
          {
            "name": "changelog",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "更新说明（多行文本）",
            "example": "示例值"
          },
          {
            "name": "forceUpdate",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "是否强制更新：1 是 / 0 否",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "状态：1 上架 / 0 下架",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/app-versions\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"platform\": \"示例值\",\n      \"version\": \"示例值\",\n      \"versionCode\": 1,\n      \"fileId\": 1,\n      \"fileSize\": 1,\n      \"changelog\": \"示例值\",\n      \"forceUpdate\": 1,\n      \"status\": 1\n    }'",
          "requestBody": {
            "platform": "示例值",
            "version": "示例值",
            "versionCode": 1,
            "fileId": 1,
            "fileSize": 1,
            "changelog": "示例值",
            "forceUpdate": 1,
            "status": 1
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/app-versions/upload",
        "summary": "上传安装包（.apk，≤200MB）。 单独一个入口而不是复用 `/files/upload`：那份配置限制 10MB、白名单是\"业务附件\"， 安装包过不去；这里只收 .apk 且上限 200MB（配 APK_MULTER_OPTIONS）",
        "permission": [
          "system:app-version:add"
        ],
        "isPublic": false,
        "action": "App 版本 · 上传安装包",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/app-versions/upload\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "PUT",
        "path": "/api/app-versions/:id",
        "summary": "编辑版本",
        "permission": [
          "system:app-version:edit"
        ],
        "isPublic": false,
        "action": "App 版本 · 编辑",
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
            "name": "platform",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "平台（当前只做 android；ios 预留）",
            "example": "示例值"
          },
          {
            "name": "version",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "版本名（展示用，如 1.2.0）",
            "example": "示例值"
          },
          {
            "name": "versionCode",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "版本序号（Android versionCode，越大越新）",
            "example": 1
          },
          {
            "name": "fileId",
            "in": "body",
            "type": "number",
            "required": true,
            "description": "安装包文件 id（先调专用上传接口拿到）",
            "example": 1
          },
          {
            "name": "fileSize",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "安装包大小（字节；不传则由文件记录兜底）",
            "example": 1
          },
          {
            "name": "changelog",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "更新说明（多行文本）",
            "example": "示例值"
          },
          {
            "name": "forceUpdate",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "是否强制更新：1 是 / 0 否",
            "example": 1
          },
          {
            "name": "status",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "状态：1 上架 / 0 下架",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X PUT \"http://localhost:3000/api/app-versions/1\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"platform\": \"示例值\",\n      \"version\": \"示例值\",\n      \"versionCode\": 1,\n      \"fileId\": 1,\n      \"fileSize\": 1,\n      \"changelog\": \"示例值\",\n      \"forceUpdate\": 1,\n      \"status\": 1\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "platform": "示例值",
            "version": "示例值",
            "versionCode": 1,
            "fileId": 1,
            "fileSize": 1,
            "changelog": "示例值",
            "forceUpdate": 1,
            "status": 1
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/app-versions/:id/status",
        "summary": "上下架",
        "permission": [
          "system:app-version:edit"
        ],
        "isPublic": false,
        "action": "App 版本 · 上下架",
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
          "curl": "curl -X PUT \"http://localhost:3000/api/app-versions/1/status\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"status\": 1\n    }'",
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
        "path": "/api/app-versions/:id",
        "summary": "删除版本记录（物理安装包由「文件管理」统一清理）",
        "permission": [
          "system:app-version:remove"
        ],
        "isPublic": false,
        "action": "App 版本 · 删除",
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
          "curl": "curl -X DELETE \"http://localhost:3000/api/app-versions/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "Chain",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/chains",
        "summary": "接龙主题列表",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/chains?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/chains/:id",
        "summary": "主题详情 + 接龙内容",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/chains/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/chains/:id/entries",
        "summary": "提交一条续写",
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
          },
          {
            "name": "contentEn",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "英文续写（必填）",
            "example": "示例值"
          },
          {
            "name": "contentZh",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "中文翻译（可选）",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/chains/1/entries\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"contentEn\": \"示例值\",\n      \"contentZh\": \"示例值\"\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "contentEn": "示例值",
            "contentZh": "示例值"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/chains/entries/:entryId/like",
        "summary": "点赞 / 取消点赞（同一入口，幂等）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "entryId",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/chains/entries/1/like\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "entryId": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/chains/entries/:entryId/report",
        "summary": "举报（一人一条一次，累计达阈值自动隐藏）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "entryId",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          },
          {
            "name": "reason",
            "in": "body",
            "type": "string",
            "required": false,
            "description": "原因：inappropriate 内容不当 / spam 广告灌水 / other 其他",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/chains/entries/1/report\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"reason\": \"示例值\"\n    }'",
          "pathParams": {
            "entryId": "1"
          },
          "requestBody": {
            "reason": "示例值"
          }
        }
      }
    ]
  },
  {
    "group": "ClientCoach",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/ai/coach/profile",
        "summary": "薄弱点画像 + 今日复习计划（纯计算、始终可用、不消耗 AI 额度）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/ai/coach/profile?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/ai/coach/advice",
        "summary": "AI 点评（可选增强；不可用时自动降级为规则文案，永远 200）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/ai/coach/advice\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      }
    ]
  },
  {
    "group": "ClientPay",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/pay/entitlements",
        "summary": "我的权益（会员状态 + 权益明细）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/pay/entitlements?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/pay/orders",
        "summary": "我的订单（分页倒序）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/pay/orders?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/pay/skus",
        "summary": "会员套餐列表（含当前会员状态；支付未配置时 enabled=false）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/pay/skus?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/pay/status/:orderNo",
        "summary": "订单状态（客户端轮询；pending 时会主动向微信补单，回调丢失也能到账）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "orderNo",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/pay/status/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "orderNo": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/pay/create",
        "summary": "创建支付订单（服务端定价；web/android 返回二维码，miniapp 返回支付参数）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/pay/create\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      }
    ]
  },
  {
    "group": "IP黑名单",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/ip-ban",
        "summary": "封禁记录分页列表",
        "permission": [
          "ip:ban:list"
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
          "curl": "curl -X GET \"http://localhost:3000/api/ip-ban?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/ip-ban/stats",
        "summary": "概览统计",
        "permission": [
          "ip:ban:list"
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
          "curl": "curl -X GET \"http://localhost:3000/api/ip-ban/stats?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/ip-ban",
        "summary": "人工封禁 IP",
        "permission": [
          "ip:ban:add"
        ],
        "isPublic": false,
        "action": "IP黑名单 · 人工封禁",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/ip-ban\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "DELETE",
        "path": "/api/ip-ban/:ip",
        "summary": "解封 IP",
        "permission": [
          "ip:ban:remove"
        ],
        "isPublic": false,
        "action": "IP黑名单 · 解封",
        "params": [
          {
            "name": "ip",
            "in": "path",
            "type": "string",
            "required": true,
            "description": "",
            "example": "1"
          }
        ],
        "examples": {
          "curl": "curl -X DELETE \"http://localhost:3000/api/ip-ban/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "ip": "1"
          }
        }
      }
    ]
  },
  {
    "group": "Ipa",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/ipa/phonemes",
        "summary": "音标库（分组分发；与进度同源，统一走 client 令牌鉴权）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/ipa/phonemes?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/ipa/progress",
        "summary": "我的进度（已学会数）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/ipa/progress?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/ipa/learned",
        "summary": "标记某个音标「学会了」（首次发 XP）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/ipa/learned\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      }
    ]
  },
  {
    "group": "Leaderboard",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/leaderboard",
        "summary": "排行榜：type=today_* / week_* / month_*（今日、近 7 天、近 30 天答题/答对前 100）、 checkin_total（累计打卡天数前 100）。响应附带当前用户名次 me（未上榜为 null）。 名次型成就（榜上有名 / 十强之列 / 三甲之列 / 榜首加冕）在这里旁路解锁：名次只有查榜单 时才算得出来，答题路径不做全表聚合；仅进入前 100 才触发，且由 GamifyService 在勋章 集齐后短路，避免每次看榜都白跑一遍",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "type",
            "in": "query",
            "type": "LeaderboardType",
            "required": true,
            "description": "榜单类型（必填）",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X GET \"http://localhost:3000/api/client/leaderboard?type=%E7%A4%BA%E4%BE%8B%E5%80%BC\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "type": "示例值"
          }
        }
      }
    ]
  },
  {
    "group": "LeaderboardAdmin",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/leaderboards/board",
        "summary": "实时榜单：type 必填，topN 可选（1~500，默认 100）",
        "permission": [
          "sentence:leaderboard"
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
          "curl": "curl -X GET \"http://localhost:3000/api/leaderboards/board?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/leaderboards/types",
        "summary": "榜单类型枚举（前端下拉用）",
        "permission": [
          "sentence:leaderboard"
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
          "curl": "curl -X GET \"http://localhost:3000/api/leaderboards/types?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/leaderboards/user",
        "summary": "按邮箱/昵称查用户在全部榜上的名次",
        "permission": [
          "sentence:leaderboard"
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
          "curl": "curl -X GET \"http://localhost:3000/api/leaderboards/user?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      }
    ]
  },
  {
    "group": "PayNotify",
    "endpoints": [
      {
        "method": "POST",
        "path": "/api/pay/notify/wechat",
        "summary": "微信支付结果通知（验签 → 解密 → 入账；重复通知幂等）",
        "permission": [],
        "isPublic": true,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/pay/notify/wechat\"",
          "isRawResponse": true
        }
      }
    ]
  },
  {
    "group": "Site",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/site",
        "summary": "读取站点公开配置（备案号）。每次实时读库，改完参数立即生效",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/site?page=1&pageSize=10\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      }
    ]
  },
  {
    "group": "Stage",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/stages",
        "summary": "闯关地图（场景 + 剧本兼容 chapters + 我的对话进度 + 可领取数）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/stages?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/stages/:id/dialogue",
        "summary": "刷新页面时读取进行中的对话（没有则 null）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/stages/1/dialogue\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/stages/scenes/:id",
        "summary": "场景详情：该场景下的剧本列表（静态段，必须声明在 ':id/...' 之前）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/stages/scenes/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/stages/scripts/:id",
        "summary": "剧本详情：该剧本下的关卡列表（含解锁/进度）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/stages/scripts/1\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/stages/:id/claim",
        "summary": "领取某关通关奖励（幂等）",
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
          "curl": "curl -X POST \"http://localhost:3000/api/client/stages/1/claim\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/stages/:id/dialogue",
        "summary": "进入关卡：有会话就续聊，没有就新建并落开场白",
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
          },
          {
            "name": "restart",
            "in": "body",
            "type": "boolean",
            "required": false,
            "description": "",
            "example": true
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/stages/1/dialogue\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"restart\": true\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "restart": true
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/stages/:id/dialogue/end",
        "summary": "主动结束对话",
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
          "curl": "curl -X POST \"http://localhost:3000/api/client/stages/1/dialogue/end\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/stages/:id/dialogue/messages",
        "summary": "发一句 → 1~3 个角色回应 → 可能结束并给出复盘",
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
          },
          {
            "name": "content",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "",
            "example": "示例值"
          },
          {
            "name": "showTranslation",
            "in": "body",
            "type": "boolean",
            "required": false,
            "description": "发送时翻译是否开启（用于无翻译通关加成反作弊；默认 true）。",
            "example": true
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/stages/1/dialogue/messages\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"content\": \"示例值\",\n      \"showTranslation\": true\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "content": "示例值",
            "showTranslation": true
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/stages/:id/dialogue/translation",
        "summary": "切换翻译显示开关（POST 别名）。 `wx.request` 不支持 PATCH，小程序侧只能走这条；Web / Android 仍用 PATCH",
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
          },
          {
            "name": "show",
            "in": "body",
            "type": "boolean",
            "required": true,
            "description": "",
            "example": true
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/stages/1/dialogue/translation\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"show\": true\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "show": true
          }
        }
      },
      {
        "method": "PATCH",
        "path": "/api/client/stages/:id/dialogue/translation",
        "summary": "切换翻译显示开关（持久化到会话，用于无翻译通关加成反作弊）",
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
          },
          {
            "name": "show",
            "in": "body",
            "type": "boolean",
            "required": true,
            "description": "",
            "example": true
          }
        ],
        "examples": {
          "curl": "curl -X PATCH \"http://localhost:3000/api/client/stages/1/dialogue/translation\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"show\": true\n    }'",
          "pathParams": {
            "id": "1"
          },
          "requestBody": {
            "show": true
          }
        }
      }
    ]
  },
  {
    "group": "Submission",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/submissions/featured",
        "summary": "投稿精选（只含审核通过的；登录可见）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/submissions/featured?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/submissions/mine",
        "summary": "我的投稿（含审核状态与驳回原因）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/submissions/mine?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/submissions",
        "summary": "提交一条投稿（英文句子 + 中文译文 + 可选附言）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/submissions\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      }
    ]
  },
  {
    "group": "SubmissionAdmin",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/submissions",
        "summary": "投稿列表（按状态 / 关键词筛选）",
        "permission": [
          "client:submission:list"
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
          "curl": "curl -X GET \"http://localhost:3000/api/submissions?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/submissions/:id/review",
        "summary": "审核：approve 进精选 / reject 驳回（可带原因，下发给投稿人）",
        "permission": [
          "client:submission:review"
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
          "curl": "curl -X POST \"http://localhost:3000/api/submissions/1/review\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      }
    ]
  },
  {
    "group": "Team",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/client/team/messages",
        "summary": "群聊消息游标分页（最近 30 天）；before = 上一页最老消息 id",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/team/messages?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "GET",
        "path": "/api/client/team/my",
        "summary": "我的小队（无队伍返回 null，前端显示「找队友」入口）",
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
          "curl": "curl -X GET \"http://localhost:3000/api/client/team/my?page=1&pageSize=10\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "query": {
            "page": 1,
            "pageSize": 10
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/team/create",
        "summary": "自建队伍：创建一个新小队并生成组队码（创建者为队长）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "name",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "小队名（2~20 字，同 rename 归一规则）",
            "example": "log-archive"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/team/create\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"name\": \"log-archive\"\n    }'",
          "requestBody": {
            "name": "log-archive"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/team/join",
        "summary": "凭组队码加入小队",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "code",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "组队码（6 位，字母数字；service 会转大写归一）",
            "example": "示例值"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/team/join\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"code\": \"示例值\"\n    }'",
          "requestBody": {
            "code": "示例值"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/team/leave",
        "summary": "退出小队（可重新匹配）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/team/leave\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/client/team/match",
        "summary": "找队友：按近 7 天练习节奏随机匹配，或新建一个随机等待池",
        "permission": [],
        "isPublic": false,
        "action": "",
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/team/match\" \\\n  -H \"Authorization: Bearer <accessToken>\""
        }
      },
      {
        "method": "POST",
        "path": "/api/client/team/messages",
        "summary": "发送群聊消息（可带 quoteId 引用某条）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "content",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "消息正文（≤500 字）",
            "example": "示例值"
          },
          {
            "name": "quoteId",
            "in": "body",
            "type": "number",
            "required": false,
            "description": "引用的消息 id（可选；必须属于同一小队）",
            "example": 1
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/team/messages\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"content\": \"示例值\",\n      \"quoteId\": 1\n    }'",
          "requestBody": {
            "content": "示例值",
            "quoteId": 1
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/team/messages/:id/recall",
        "summary": "撤回自己的消息（2 分钟内）",
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
          "curl": "curl -X POST \"http://localhost:3000/api/client/team/messages/1/recall\" \\\n  -H \"Authorization: Bearer <accessToken>\"",
          "pathParams": {
            "id": "1"
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/client/team/name",
        "summary": "修改小队名（POST 别名）。 微信小程序的 `wx.request` **不支持 PATCH**，只能 GET/POST/PUT/DELETE， 故为小程序留一条等价入口；Web / Android 继续用上面的 PATCH（语义更准确）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "name",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "新小队名（service 会去空白、压缩连续空格，并按码点校验 2~20 字）",
            "example": "log-archive"
          }
        ],
        "examples": {
          "curl": "curl -X POST \"http://localhost:3000/api/client/team/name\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"name\": \"log-archive\"\n    }'",
          "requestBody": {
            "name": "log-archive"
          }
        }
      },
      {
        "method": "PATCH",
        "path": "/api/client/team/name",
        "summary": "修改小队名（任意成员可改，改完全队可见）",
        "permission": [],
        "isPublic": false,
        "action": "",
        "params": [
          {
            "name": "name",
            "in": "body",
            "type": "string",
            "required": true,
            "description": "新小队名（service 会去空白、压缩连续空格，并按码点校验 2~20 字）",
            "example": "log-archive"
          }
        ],
        "examples": {
          "curl": "curl -X PATCH \"http://localhost:3000/api/client/team/name\" \\\n  -H \"Authorization: Bearer <accessToken>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n      \"name\": \"log-archive\"\n    }'",
          "requestBody": {
            "name": "log-archive"
          }
        }
      }
    ]
  }
];
