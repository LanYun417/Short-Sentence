/**
 * OpenAPI 3.0 文档（自动生成，请勿手工编辑）。
 *
 * 由 `scripts/gen-api-docs.mjs` 在构建期从同一份控制器/DTO 扫描数据重映射生成；
 * 运行时由 `docs.controller` 的 `GET /api/docs/openapi.json` 注入响应示例后返回。
 * 可用于 Swagger UI / Redoc / Postman 导入 / 客户端代码生成。
 */
export const OPENAPI_DOC: Record<string, unknown> = {
  "openapi": "3.0.3",
  "info": {
    "title": "LY Admin API",
    "version": "1.0.0",
    "description": "LY Admin 后台接口（OpenAPI 3.0 导出）。所有成功响应统一包装为 { code, message, data }。"
  },
  "servers": [
    {
      "url": "http://localhost:3000",
      "description": "本地开发环境"
    }
  ],
  "tags": [
    {
      "name": "仪表盘"
    },
    {
      "name": "认证"
    },
    {
      "name": "用户管理"
    },
    {
      "name": "角色管理"
    },
    {
      "name": "菜单管理"
    },
    {
      "name": "字典管理"
    },
    {
      "name": "参数管理"
    },
    {
      "name": "定时任务"
    },
    {
      "name": "日志管理"
    },
    {
      "name": "文件管理"
    },
    {
      "name": "代码生成"
    },
    {
      "name": "个人中心"
    },
    {
      "name": "接口文档"
    },
    {
      "name": "在线用户"
    },
    {
      "name": "系统监控"
    },
    {
      "name": "通知中心"
    },
    {
      "name": "系统"
    },
    {
      "name": "部门/岗位管理"
    },
    {
      "name": "场景分类"
    },
    {
      "name": "成长激励"
    },
    {
      "name": "词根查询"
    },
    {
      "name": "词根词典"
    },
    {
      "name": "句签"
    },
    {
      "name": "句签管理"
    },
    {
      "name": "客户端反馈"
    },
    {
      "name": "客户端公告"
    },
    {
      "name": "客户端认证"
    },
    {
      "name": "客户端通知"
    },
    {
      "name": "客户端应用"
    },
    {
      "name": "客户端用户"
    },
    {
      "name": "每日打卡"
    },
    {
      "name": "数据分析"
    },
    {
      "name": "刷题"
    },
    {
      "name": "题库管理"
    },
    {
      "name": "题目举报"
    },
    {
      "name": "用户反馈"
    },
    {
      "name": "邮件设置"
    },
    {
      "name": "语句库"
    },
    {
      "name": "AI 设置"
    },
    {
      "name": "AI 拓展"
    },
    {
      "name": "App 版本"
    },
    {
      "name": "IP黑名单"
    },
    {
      "name": "Leaderboard"
    }
  ],
  "paths": {
    "/api/dashboard/login-trend": {
      "get": {
        "tags": [
          "仪表盘"
        ],
        "summary": "登录趋势",
        "operationId": "get__api_dashboard_login_trend",
        "parameters": [
          {
            "name": "days",
            "in": "query",
            "required": false,
            "schema": {
              "type": "number",
              "example": 7
            }
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dashboard/operation-distribution": {
      "get": {
        "tags": [
          "仪表盘"
        ],
        "summary": "操作类型分布",
        "operationId": "get__api_dashboard_operation_distribution",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dashboard/role-user-count": {
      "get": {
        "tags": [
          "仪表盘"
        ],
        "summary": "各角色用户数",
        "operationId": "get__api_dashboard_role_user_count",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dashboard/stats": {
      "get": {
        "tags": [
          "仪表盘"
        ],
        "summary": "统计卡片",
        "operationId": "get__api_dashboard_stats",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/auth/captcha": {
      "get": {
        "tags": [
          "认证"
        ],
        "summary": "图形验证码：公开接口（登录前获取）",
        "operationId": "get__api_auth_captcha",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/menus": {
      "get": {
        "tags": [
          "认证"
        ],
        "summary": "当前用户菜单树（仅目录/菜单节点，按角色 + 用户级额外权限覆盖过滤）",
        "operationId": "get__api_auth_menus",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/auth/permissions": {
      "get": {
        "tags": [
          "认证"
        ],
        "summary": "当前用户权限码列表",
        "operationId": "get__api_auth_permissions",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/auth/profile": {
      "get": {
        "tags": [
          "认证"
        ],
        "summary": "当前用户信息",
        "operationId": "get__api_auth_profile",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/auth/login": {
      "post": {
        "tags": [
          "认证"
        ],
        "summary": "登录。 挂载频率限制：连续失败 5 次 / 5 分钟 → 锁定 15 分钟（返回 429）",
        "operationId": "post__api_auth_login",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LoginDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/LoginDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/logout": {
      "post": {
        "tags": [
          "认证"
        ],
        "summary": "登出",
        "operationId": "post__api_auth_logout",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/auth/refresh": {
      "post": {
        "tags": [
          "认证"
        ],
        "summary": "刷新 Token",
        "operationId": "post__api_auth_refresh",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RefreshDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/RefreshDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/users": {
      "get": {
        "tags": [
          "用户管理"
        ],
        "summary": "分页列表（含数据权限过滤）",
        "operationId": "get__api_users",
        "parameters": [
          {
            "name": "username",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "deptId",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "用户管理"
        ],
        "summary": "新增用户",
        "operationId": "post__api_users",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateUserDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/CreateUserDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "用户管理"
        ],
        "summary": "批量删除用户。 复用单条删除的权限码（这是同一个能力，不该再拆一个权限出来）； 返回明细而非「全成功/全失败」：批量里被超管保护或自身账号挡下的条目要能说清原因",
        "operationId": "delete__api_users",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/{id}": {
      "get": {
        "tags": [
          "用户管理"
        ],
        "summary": "用户详情",
        "operationId": "get__api_users__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "用户管理"
        ],
        "summary": "编辑用户",
        "operationId": "put__api_users__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateUserDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateUserDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "用户管理"
        ],
        "summary": "删除用户",
        "operationId": "delete__api_users__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/{id}/menus": {
      "get": {
        "tags": [
          "用户管理"
        ],
        "summary": "用户的菜单权限概况：角色自带 / 额外授予 / 额外撤销 / 最终有效。 用于「额外权限」抽屉回填：最终有效用于勾选，角色自带用于标注来源",
        "operationId": "get__api_users__id_menus",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "用户管理"
        ],
        "summary": "保存用户的额外菜单权限。 入参为「期望的最终有效菜单集合」，服务端与角色自带集合求差得出额外授予 / 额外撤销",
        "operationId": "put__api_users__id_menus",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AssignUserMenuDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/AssignUserMenuDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/import/template": {
      "get": {
        "tags": [
          "用户管理"
        ],
        "summary": "下载 CSV 导入模板。 必须声明在 `@Get(':id')` **之前**：Nest 按声明顺序匹配，否则 `import/template` 会被 `:id` 吃掉",
        "operationId": "get__api_users_import_template",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/import": {
      "post": {
        "tags": [
          "用户管理"
        ],
        "summary": "批量导入用户（CSV，全成功或全不写）。 行级校验失败返回 200 + 逐行报告（`data.failed`），请求级问题（空文件/缺列/超行数）才是 400",
        "operationId": "post__api_users_import",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/{id}/password": {
      "put": {
        "tags": [
          "用户管理"
        ],
        "summary": "重置密码",
        "operationId": "put__api_users__id_password",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ResetPasswordDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/ResetPasswordDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/{id}/roles": {
      "put": {
        "tags": [
          "用户管理"
        ],
        "summary": "分配角色",
        "operationId": "put__api_users__id_roles",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AssignRoleDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/AssignRoleDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/{id}/status": {
      "put": {
        "tags": [
          "用户管理"
        ],
        "summary": "启用/禁用",
        "operationId": "put__api_users__id_status",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/StatusDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/StatusDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/roles": {
      "get": {
        "tags": [
          "角色管理"
        ],
        "summary": "角色分页列表",
        "operationId": "get__api_roles",
        "parameters": [
          {
            "name": "roleName",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "角色管理"
        ],
        "summary": "新增角色",
        "operationId": "post__api_roles",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateRoleDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/CreateRoleDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "角色管理"
        ],
        "summary": "批量删除角色（复用单条删除的权限码；逐条执行并返回被跳过明细）",
        "operationId": "delete__api_roles",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/roles/{id}/menus": {
      "get": {
        "tags": [
          "角色管理"
        ],
        "summary": "角色已授权菜单 id",
        "operationId": "get__api_roles__id_menus",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "角色管理"
        ],
        "summary": "授权角色菜单",
        "operationId": "put__api_roles__id_menus",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AssignMenuDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/AssignMenuDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/roles/all": {
      "get": {
        "tags": [
          "角色管理"
        ],
        "summary": "全部角色下拉。 使用独立权限码 system:role:all，而非复用只读的 system:role:list： admin 角色刻意不授予 system:role:list，而本接口是给持 system:user:assignRole 的角色 拉取「分配角色」下拉框用的；复用 system:role:list 会把该能力收死，故新开独立码",
        "operationId": "get__api_roles_all",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/roles/reset-menus": {
      "post": {
        "tags": [
          "角色管理"
        ],
        "summary": "按种子定义恢复角色的默认菜单授权（「恢复默认授权」）。 为什么需要它：启动种子只负责**首次创建**角色并写授权，不再每次重启都覆盖 （那会把运维调好的授权静默回滚）；所以\"想回到种子默认\"必须由运维显式触发。 权限码复用 `system:role:assignMenu`：这与「授权菜单」是同一种能力（写角色菜单授权）， 只是数据来源换成种子定义；按项目「同一能力不拆权限码」的约定不新增码",
        "operationId": "post__api_roles_reset_menus",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ResetRoleMenusDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/ResetRoleMenusDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/roles/{id}": {
      "put": {
        "tags": [
          "角色管理"
        ],
        "summary": "编辑角色",
        "operationId": "put__api_roles__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateRoleDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateRoleDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "角色管理"
        ],
        "summary": "删除角色",
        "operationId": "delete__api_roles__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/menus": {
      "get": {
        "tags": [
          "菜单管理"
        ],
        "summary": "菜单列表（tree=1 返回树）",
        "operationId": "get__api_menus",
        "parameters": [
          {
            "name": "menuName",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "tree",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "菜单管理"
        ],
        "summary": "创建菜单",
        "operationId": "post__api_menus",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/MenuUpsertDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/MenuUpsertDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/menus/{id}": {
      "get": {
        "tags": [
          "菜单管理"
        ],
        "summary": "菜单详情",
        "operationId": "get__api_menus__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "菜单管理"
        ],
        "summary": "更新菜单",
        "operationId": "put__api_menus__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/MenuUpsertDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/MenuUpsertDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "菜单管理"
        ],
        "summary": "删除菜单",
        "operationId": "delete__api_menus__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/menus/tree": {
      "get": {
        "tags": [
          "菜单管理"
        ],
        "summary": "全量菜单树（含按钮，供角色授权）",
        "operationId": "get__api_menus_tree",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/data/{dictType}": {
      "get": {
        "tags": [
          "字典管理"
        ],
        "summary": "按类型编码取启用中的字典项（标签 + 值）。 仅需登录、不设权限码（与 /api/profile 的「自有资源豁免」同类处理）",
        "operationId": "get__api_dict_data__dictType",
        "parameters": [
          {
            "name": "dictType",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 dictType"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/items": {
      "get": {
        "tags": [
          "字典管理"
        ],
        "summary": "字典项分页列表（按 dictType 过滤）",
        "operationId": "get__api_dict_items",
        "parameters": [
          {
            "name": "dictType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "dictLabel",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "字典管理"
        ],
        "summary": "新增字典项",
        "operationId": "post__api_dict_items",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateDictItemDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/CreateDictItemDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "字典管理"
        ],
        "summary": "批量删除字典项（逐条执行并返回被跳过明细）",
        "operationId": "delete__api_dict_items",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/types": {
      "get": {
        "tags": [
          "字典管理"
        ],
        "summary": "字典类型分页列表",
        "operationId": "get__api_dict_types",
        "parameters": [
          {
            "name": "dictName",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "dictType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "字典管理"
        ],
        "summary": "新增字典类型",
        "operationId": "post__api_dict_types",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateDictTypeDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/CreateDictTypeDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "字典管理"
        ],
        "summary": "批量删除字典类型（连带删除各自字典项；逐条执行并返回被跳过明细）",
        "operationId": "delete__api_dict_types",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/items/{id}": {
      "put": {
        "tags": [
          "字典管理"
        ],
        "summary": "编辑字典项",
        "operationId": "put__api_dict_items__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateDictItemDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateDictItemDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "字典管理"
        ],
        "summary": "删除字典项",
        "operationId": "delete__api_dict_items__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/items/{id}/status": {
      "put": {
        "tags": [
          "字典管理"
        ],
        "summary": "启用 / 禁用字典项（写操作，复用 system:dict:edit）",
        "operationId": "put__api_dict_items__id_status",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SetStatusDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/SetStatusDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/types/{id}": {
      "put": {
        "tags": [
          "字典管理"
        ],
        "summary": "编辑字典类型",
        "operationId": "put__api_dict_types__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateDictTypeDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateDictTypeDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "字典管理"
        ],
        "summary": "删除字典类型（连带删除其下字典项）",
        "operationId": "delete__api_dict_types__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/types/{id}/status": {
      "put": {
        "tags": [
          "字典管理"
        ],
        "summary": "启用 / 禁用字典类型（写操作，复用 system:dict:edit）",
        "operationId": "put__api_dict_types__id_status",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SetStatusDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/SetStatusDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/configs": {
      "get": {
        "tags": [
          "参数管理"
        ],
        "summary": "参数分页列表",
        "operationId": "get__api_configs",
        "parameters": [
          {
            "name": "configName",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "configKey",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "参数管理"
        ],
        "summary": "新增参数",
        "operationId": "post__api_configs",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateConfigDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/CreateConfigDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/configs/{id}": {
      "get": {
        "tags": [
          "参数管理"
        ],
        "summary": "参数详情",
        "operationId": "get__api_configs__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "参数管理"
        ],
        "summary": "编辑参数（键名不可改）",
        "operationId": "put__api_configs__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateConfigDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateConfigDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "参数管理"
        ],
        "summary": "删除参数（内置参数不可删除）",
        "operationId": "delete__api_configs__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/configs/data/{configKey}": {
      "get": {
        "tags": [
          "参数管理"
        ],
        "summary": "按键取参数值（业务取数，仅需登录、不设权限码）",
        "operationId": "get__api_configs_data__configKey",
        "parameters": [
          {
            "name": "configKey",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 configKey"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/tasks": {
      "get": {
        "tags": [
          "定时任务"
        ],
        "summary": "定时任务列表（含调度状态与上次执行摘要）",
        "operationId": "get__api_tasks",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/tasks/{name}/logs": {
      "get": {
        "tags": [
          "定时任务"
        ],
        "summary": "某任务的执行记录（分页）。 查询参数用 `Record<string, unknown>` 而非 DTO：全局 ValidationPipe 开了 whitelist， DTO 里未声明的字段（page / pageSize）会被剥掉，导致分页参数丢失。 故与日志模块保持一致，筛选条件的解析放在 service 层",
        "operationId": "get__api_tasks__name_logs",
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 name"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/tasks/{name}/run": {
      "post": {
        "tags": [
          "定时任务"
        ],
        "summary": "手动触发任务（同步等待执行结果）",
        "operationId": "post__api_tasks__name_run",
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 name"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/http": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "HTTP 访问日志列表",
        "operationId": "get__api_logs_http",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "清空所有 HTTP 访问日志（高危操作，独立权限码 log:http:clear）",
        "operationId": "delete__api_logs_http",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/http/detail/{id}": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "HTTP 日志详情（请求 / 响应体按需加载）",
        "operationId": "get__api_logs_http_detail__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/http/export": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "导出 HTTP 访问日志 CSV（流式）",
        "operationId": "get__api_logs_http_export",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/login": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "登录日志列表",
        "operationId": "get__api_logs_login",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/login/export": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "导出登录日志 CSV（流式：分批查、逐批写，内存不随行数增长）",
        "operationId": "get__api_logs_login_export",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/operation": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "操作日志列表",
        "operationId": "get__api_logs_operation",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/operation/export": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "导出操作日志 CSV（流式）",
        "operationId": "get__api_logs_operation_export",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/http/{id}": {
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "删除单条 HTTP 访问日志",
        "operationId": "delete__api_logs_http__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/http/batch": {
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "批量删除 HTTP 访问日志（多选）",
        "operationId": "delete__api_logs_http_batch",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/login/{id}": {
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "删除单条登录日志",
        "operationId": "delete__api_logs_login__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/login/batch": {
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "批量删除登录日志（多选）",
        "operationId": "delete__api_logs_login_batch",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/operation/{id}": {
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "删除单条操作日志",
        "operationId": "delete__api_logs_operation__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/operation/batch": {
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "批量删除操作日志（多选）",
        "operationId": "delete__api_logs_operation_batch",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files": {
      "get": {
        "tags": [
          "文件管理"
        ],
        "summary": "文件列表",
        "operationId": "get__api_files",
        "parameters": [
          {
            "name": "originName",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "mimeType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "uploaderId",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "bizType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "bizId",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "startTime",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "endTime",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "minSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "maxSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/{id}/download": {
      "get": {
        "tags": [
          "文件管理"
        ],
        "summary": "下载文件：强制附件语义（Content-Disposition: attachment）。 中文文件名由 Express 自动编码；CR/LF/引号已去除避免响应头注入",
        "operationId": "get__api_files__id_download",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/check": {
      "get": {
        "tags": [
          "文件管理"
        ],
        "summary": "秒传预检：按内容哈希查询库内是否已存在相同文件",
        "operationId": "get__api_files_check",
        "parameters": [
          {
            "name": "hash",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string",
              "example": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/quota": {
      "get": {
        "tags": [
          "文件管理"
        ],
        "summary": "当前用户的上传配额使用情况（供前端展示「已用 / 上限」）",
        "operationId": "get__api_files_quota",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/types": {
      "get": {
        "tags": [
          "文件管理"
        ],
        "summary": "文件类型选项（对库内已有文件去重，供筛选下拉使用）",
        "operationId": "get__api_files_types",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/uploaders": {
      "get": {
        "tags": [
          "文件管理"
        ],
        "summary": "上传人选项（对库内已有上传人去重并关联用户表）",
        "operationId": "get__api_files_uploaders",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/upload": {
      "post": {
        "tags": [
          "文件管理"
        ],
        "summary": "上传（单/多文件，兼容任意字段名）",
        "operationId": "post__api_files_upload",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UploadBizDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UploadBizDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/{id}": {
      "delete": {
        "tags": [
          "文件管理"
        ],
        "summary": "删除文件",
        "operationId": "delete__api_files__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/gen/tables": {
      "get": {
        "tags": [
          "代码生成"
        ],
        "summary": "列出全部业务表（读 information_schema.TABLES）",
        "operationId": "get__api_gen_tables",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/gen/tables/{tableName}": {
      "get": {
        "tags": [
          "代码生成"
        ],
        "summary": "指定表的字段结构详情",
        "operationId": "get__api_gen_tables__tableName",
        "parameters": [
          {
            "name": "tableName",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 tableName"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/gen/create": {
      "post": {
        "tags": [
          "代码生成"
        ],
        "summary": "生成代码并直接写入项目目录（含自动接线）",
        "operationId": "post__api_gen_create",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/GenCreateDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/GenCreateDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/gen/download": {
      "post": {
        "tags": [
          "代码生成"
        ],
        "summary": "生成并下载代码（ZIP 二进制流）",
        "operationId": "post__api_gen_download",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/GenConfigDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/gen/preview": {
      "post": {
        "tags": [
          "代码生成"
        ],
        "summary": "在线预览生成的代码（返回文件列表）",
        "operationId": "post__api_gen_preview",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/GenConfigDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/GenConfigDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/profile/avatar": {
      "post": {
        "tags": [
          "个人中心"
        ],
        "summary": "更换头像",
        "operationId": "post__api_profile_avatar",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/profile": {
      "put": {
        "tags": [
          "个人中心"
        ],
        "summary": "修改资料",
        "operationId": "put__api_profile",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateProfileDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateProfileDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/profile/password": {
      "put": {
        "tags": [
          "个人中心"
        ],
        "summary": "修改密码",
        "operationId": "put__api_profile_password",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ChangePasswordDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/ChangePasswordDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/docs": {
      "get": {
        "tags": [
          "接口文档"
        ],
        "summary": "全部接口清单（按业务模块分组）",
        "operationId": "get__api_docs",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/docs/openapi.json": {
      "get": {
        "tags": [
          "接口文档"
        ],
        "summary": "OpenAPI 3.0 文档（注入响应示例，server 指向当前运行实例，可直接被 Swagger UI 消费）",
        "operationId": "get__api_docs_openapi_json",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        }
      }
    },
    "/api/monitor/online": {
      "get": {
        "tags": [
          "在线用户"
        ],
        "summary": "在线会话列表",
        "operationId": "get__api_monitor_online",
        "parameters": [
          {
            "name": "username",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "ip",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/monitor/online/{sid}": {
      "delete": {
        "tags": [
          "在线用户"
        ],
        "summary": "强制下线单个会话",
        "operationId": "delete__api_monitor_online__sid",
        "parameters": [
          {
            "name": "sid",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 sid"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/monitor/online/user/{userId}": {
      "delete": {
        "tags": [
          "在线用户"
        ],
        "summary": "强制下线某用户的全部会话",
        "operationId": "delete__api_monitor_online_user__userId",
        "parameters": [
          {
            "name": "userId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 userId"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/monitor/server": {
      "get": {
        "tags": [
          "系统监控"
        ],
        "summary": "系统资源快照。 刻意**不记操作日志**：页面每几秒轮询一次，记日志只会把 sys_operation_log 灌满噪音， 而\"读指标\"本身没有审计价值（真正需要留痕的是强退这类写操作）",
        "operationId": "get__api_monitor_server",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/notices": {
      "get": {
        "tags": [
          "通知中心"
        ],
        "summary": "我的收件箱（未读优先 + 时间倒序）",
        "operationId": "get__api_notices",
        "parameters": [
          {
            "name": "isRead",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "noticeType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "title",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "通知中心"
        ],
        "summary": "发布通知（指定人或全员）",
        "operationId": "post__api_notices",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "通知中心"
        ],
        "summary": "清空我的通知",
        "operationId": "delete__api_notices",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/notices/unread-count": {
      "get": {
        "tags": [
          "通知中心"
        ],
        "summary": "未读数（顶栏红点）",
        "operationId": "get__api_notices_unread_count",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/notices/{id}/read": {
      "put": {
        "tags": [
          "通知中心"
        ],
        "summary": "标记已读",
        "operationId": "put__api_notices__id_read",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/notices/read-all": {
      "put": {
        "tags": [
          "通知中心"
        ],
        "summary": "全部标记已读",
        "operationId": "put__api_notices_read_all",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/notices/{id}": {
      "delete": {
        "tags": [
          "通知中心"
        ],
        "summary": "删除一条通知",
        "operationId": "delete__api_notices__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api": {
      "get": {
        "tags": [
          "系统"
        ],
        "summary": "健康检查：返回服务名称、状态与服务器时间",
        "operationId": "get__api",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/health/live": {
      "get": {
        "tags": [
          "系统"
        ],
        "summary": "存活探针：仅证明进程可响应，不探测任何依赖（供 livenessProbe）",
        "operationId": "get__api_health_live",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/health/ready": {
      "get": {
        "tags": [
          "系统"
        ],
        "summary": "就绪探针：探测 MySQL 与 Redis；MySQL 不可用返回 503，Redis 不可用标记 degraded（仍 200）",
        "operationId": "get__api_health_ready",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/depts": {
      "get": {
        "tags": [
          "部门/岗位管理"
        ],
        "summary": "部门列表（tree=1 时返回树）",
        "operationId": "get__api_depts",
        "parameters": [
          {
            "name": "deptName",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "tree",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "部门/岗位管理"
        ],
        "summary": "新增部门",
        "operationId": "post__api_depts",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/DeptUpsertDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/DeptUpsertDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/depts/{id}": {
      "get": {
        "tags": [
          "部门/岗位管理"
        ],
        "summary": "部门详情",
        "operationId": "get__api_depts__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "部门/岗位管理"
        ],
        "summary": "编辑部门",
        "operationId": "put__api_depts__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/DeptUpsertDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/DeptUpsertDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "部门/岗位管理"
        ],
        "summary": "删除部门",
        "operationId": "delete__api_depts__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/depts/tree": {
      "get": {
        "tags": [
          "部门/岗位管理"
        ],
        "summary": "完整部门树（上级选择）",
        "operationId": "get__api_depts_tree",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/categories": {
      "get": {
        "tags": [
          "场景分类"
        ],
        "summary": "启用中的**日常场景**分类（按 sort 升序），附各分类的可刷题数。 游客可访问（首页展示用）。 - **排除节日分类**：节日有专属题库接口（/client/questions/festivals）， 混进来会在题库页出现两份「元旦」。 - 题数一次 groupBy 拿全量再内存合并：分类就两位数，不值得每行发一条 count",
        "operationId": "get__api_client_categories",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/client/gamify/overview": {
      "get": {
        "tags": [
          "成长激励"
        ],
        "summary": "成长概览（XP / 等级 / 成就 / 场景地图）",
        "operationId": "get__api_client_gamify_overview",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/word-roots": {
      "get": {
        "tags": [
          "词根查询"
        ],
        "summary": "搜索词根词典（q 为空时返回热门词）",
        "operationId": "get__api_client_word_roots",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "词根查询"
        ],
        "summary": "收录词条：把「AI 词根拆解」的结果落库（词库已有则不覆盖，幂等）",
        "operationId": "post__api_client_word_roots",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/word-roots/{word}": {
      "get": {
        "tags": [
          "词根查询"
        ],
        "summary": "查词：命中缓存直接返回，未命中实时 AI 解析并入库。 缓存未命中会计一次 AI 额度（命中不扣）",
        "operationId": "get__api_client_word_roots__word",
        "parameters": [
          {
            "name": "word",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 word"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/word-roots": {
      "get": {
        "tags": [
          "词根词典"
        ],
        "summary": "分页列表（筛选：关键词 / 来源）",
        "operationId": "get__api_word_roots",
        "parameters": [
          {
            "name": "keyword",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "source",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/word-roots/{id}": {
      "get": {
        "tags": [
          "词根词典"
        ],
        "summary": "详情",
        "operationId": "get__api_word_roots__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "词根词典"
        ],
        "summary": "编辑",
        "operationId": "put__api_word_roots__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateWordRootDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateWordRootDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "词根词典"
        ],
        "summary": "删除",
        "operationId": "delete__api_word_roots__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/word-roots/analyze": {
      "post": {
        "tags": [
          "词根词典"
        ],
        "summary": "按单词立即解析并入库（单条，通常 3~10s）",
        "operationId": "post__api_word_roots_analyze",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AnalyzeWordDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/AnalyzeWordDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/sentence-card/mine": {
      "get": {
        "tags": [
          "句签"
        ],
        "summary": "我的句签列表（按获得时间倒序）",
        "operationId": "get__api_client_sentence_card_mine",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/sentence-card/missing": {
      "get": {
        "tags": [
          "句签"
        ],
        "summary": "未拥有的句签（已就绪 − 已获得；含总数与最近一批）",
        "operationId": "get__api_client_sentence_card_missing",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/sentence-card/today": {
      "get": {
        "tags": [
          "句签"
        ],
        "summary": "今日句签是否已获得（导航头像常驻特效用；轻量查询，不返回卡片内容）",
        "operationId": "get__api_client_sentence_card_today",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/sentence-card/claim": {
      "post": {
        "tags": [
          "句签"
        ],
        "summary": "领取今日句签（完成每日目标且今日句签就绪时返回；否则 null）",
        "operationId": "post__api_client_sentence_card_claim",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentence-cards": {
      "get": {
        "tags": [
          "句签管理"
        ],
        "summary": "分页列表（筛选：status / 日期区间 / 关键词）",
        "operationId": "get__api_sentence_cards",
        "parameters": [
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "keyword",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "startDate",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "endDate",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentence-cards/{id}": {
      "get": {
        "tags": [
          "句签管理"
        ],
        "summary": "详情（含最近领取用户）",
        "operationId": "get__api_sentence_cards__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "句签管理"
        ],
        "summary": "编辑文案",
        "operationId": "put__api_sentence_cards__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateSentenceCardDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateSentenceCardDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "句签管理"
        ],
        "summary": "删除（连带领取记录）",
        "operationId": "delete__api_sentence_cards__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentence-cards/generate": {
      "post": {
        "tags": [
          "句签管理"
        ],
        "summary": "按日期重新生成（同步等待 AI 文案 + 生图，通常 10~40s）。 ⚠️ 必须声明在 `@Get(':id')` 之前不是必需的（方法不同），但保持与其他模块一致的可读性",
        "operationId": "post__api_sentence_cards_generate",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/GenerateSentenceCardDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/GenerateSentenceCardDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-feedbacks": {
      "get": {
        "tags": [
          "客户端反馈"
        ],
        "summary": "反馈列表（筛选：status / type / platform / keyword）",
        "operationId": "get__api_client_feedbacks",
        "parameters": [
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "type",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "platform",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "keyword",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-feedbacks/{id}": {
      "put": {
        "tags": [
          "客户端反馈"
        ],
        "summary": "处理反馈（标记已处理/已驳回 + 回复 + 内部备注）",
        "operationId": "put__api_client_feedbacks__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/HandleFeedbackDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/HandleFeedbackDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/notices": {
      "get": {
        "tags": [
          "客户端公告"
        ],
        "summary": "我的通知列表（已发布；置顶优先，其次按发布时间倒序）",
        "operationId": "get__api_client_notices",
        "parameters": [
          {
            "name": "noticeType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "isRead",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/notices/unread-count": {
      "get": {
        "tags": [
          "客户端公告"
        ],
        "summary": "未读数（客户端红点）",
        "operationId": "get__api_client_notices_unread_count",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/notices/{id}/read": {
      "post": {
        "tags": [
          "客户端公告"
        ],
        "summary": "标记单条已读（幂等，重复点不报错）",
        "operationId": "post__api_client_notices__id_read",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/notices/read-all": {
      "post": {
        "tags": [
          "客户端公告"
        ],
        "summary": "全部标记已读",
        "operationId": "post__api_client_notices_read_all",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/auth/captcha": {
      "get": {
        "tags": [
          "客户端认证"
        ],
        "summary": "图形验证码（登录/注册前拉取；关闭验证码时 enabled=false）",
        "operationId": "get__api_client_auth_captcha",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/client/auth/me": {
      "get": {
        "tags": [
          "客户端认证"
        ],
        "summary": "我的资料",
        "operationId": "get__api_client_auth_me",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "客户端认证"
        ],
        "summary": "更新资料",
        "operationId": "put__api_client_auth_me",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/auth/avatar": {
      "post": {
        "tags": [
          "客户端认证"
        ],
        "summary": "上传头像（单文件；自动替换旧头像并清理原文件）",
        "operationId": "post__api_client_auth_avatar",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/auth/email-code": {
      "post": {
        "tags": [
          "客户端认证"
        ],
        "summary": "发送邮箱验证码（注册/登录/重置密码；同邮箱同用途 60 秒只能发一次）",
        "operationId": "post__api_client_auth_email_code",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/client/auth/login": {
      "post": {
        "tags": [
          "客户端认证"
        ],
        "summary": "登录",
        "operationId": "post__api_client_auth_login",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/client/auth/logout": {
      "post": {
        "tags": [
          "客户端认证"
        ],
        "summary": "登出（服务端令旧令牌失效）",
        "operationId": "post__api_client_auth_logout",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/auth/refresh": {
      "post": {
        "tags": [
          "客户端认证"
        ],
        "summary": "刷新令牌",
        "operationId": "post__api_client_auth_refresh",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/client/auth/register": {
      "post": {
        "tags": [
          "客户端认证"
        ],
        "summary": "注册",
        "operationId": "post__api_client_auth_register",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/client/auth/me/background": {
      "put": {
        "tags": [
          "客户端认证"
        ],
        "summary": "设置个人主页背景句签（cardId=0 恢复默认渐变；仅限已获得的句签）",
        "operationId": "put__api_client_auth_me_background",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/auth/password": {
      "put": {
        "tags": [
          "客户端认证"
        ],
        "summary": "修改密码",
        "operationId": "put__api_client_auth_password",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-notices": {
      "get": {
        "tags": [
          "客户端通知"
        ],
        "summary": "公告列表（含草稿/已撤回，带已读人数）",
        "operationId": "get__api_client_notices",
        "parameters": [
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "noticeType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "title",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "客户端通知"
        ],
        "summary": "发布公告",
        "operationId": "post__api_client_notices",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-notices/{id}": {
      "put": {
        "tags": [
          "客户端通知"
        ],
        "summary": "编辑公告",
        "operationId": "put__api_client_notices__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "客户端通知"
        ],
        "summary": "删除公告",
        "operationId": "delete__api_client_notices__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-notices/{id}/status": {
      "put": {
        "tags": [
          "客户端通知"
        ],
        "summary": "发布 / 撤回",
        "operationId": "put__api_client_notices__id_status",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/app/download/{id}": {
      "get": {
        "tags": [
          "客户端应用"
        ],
        "summary": "下载安装包（游客可访问；每次下载计一次数）",
        "operationId": "get__api_client_app_download__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        }
      }
    },
    "/api/client/app/latest": {
      "get": {
        "tags": [
          "客户端应用"
        ],
        "summary": "最新上架版本（游客可访问：下载页不需要登录）。空 = 尚未发布",
        "operationId": "get__api_client_app_latest",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/client-users": {
      "get": {
        "tags": [
          "客户端用户"
        ],
        "summary": "分页列表（关键词 / 状态 / 性别）。 查询参数用 `Record<string, unknown>` 而非 DTO：全局 ValidationPipe 开了 whitelist， DTO 里未声明的字段（page / pageSize）会被剥掉，导致分页参数丢失——翻页时永远回第 1 页 （症状：列表里翻不到的人，一搜关键词却能搜到）。故与日志 / 任务模块保持一致， 筛选条件的解析全部放在 service 层",
        "operationId": "get__api_client_users",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-users/{id}": {
      "get": {
        "tags": [
          "客户端用户"
        ],
        "summary": "详情（含学习数据与最近答题）",
        "operationId": "get__api_client_users__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "客户端用户"
        ],
        "summary": "删除用户（级联清理学习数据；日志类表不动，保留审计痕迹）",
        "operationId": "delete__api_client_users__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-users/{id}/ai-quota": {
      "get": {
        "tags": [
          "客户端用户"
        ],
        "summary": "今日 AI 额度用量（运营排查「这个人是不是把 AI 刷爆了」用）",
        "operationId": "get__api_client_users__id_ai_quota",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-users/{id}/growth": {
      "get": {
        "tags": [
          "客户端用户"
        ],
        "summary": "成长概览（XP / 等级 / 成就 / 场景地图）——与客户端个人中心「成长」同源",
        "operationId": "get__api_client_users__id_growth",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-users/{id}/sentence-cards": {
      "get": {
        "tags": [
          "客户端用户"
        ],
        "summary": "已获得的句签列表（按获得时间倒序）",
        "operationId": "get__api_client_users__id_sentence_cards",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-users/{id}/sentence-cards/missing": {
      "get": {
        "tags": [
          "客户端用户"
        ],
        "summary": "未拥有的句签（已就绪 − 已获得；total + 最近一批，供详情弹窗「未拥有」区展示）",
        "operationId": "get__api_client_users__id_sentence_cards_missing",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-users/export": {
      "get": {
        "tags": [
          "客户端用户"
        ],
        "summary": "导出客户端用户 CSV（流式；筛选与列表共用同一套条件）",
        "operationId": "get__api_client_users_export",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-users/{id}/offline": {
      "post": {
        "tags": [
          "客户端用户"
        ],
        "summary": "强制下线（不改密码，仅令旧令牌失效）",
        "operationId": "post__api_client_users__id_offline",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-users/{id}/sentence-cards/backfill": {
      "post": {
        "tags": [
          "客户端用户"
        ],
        "summary": "补发过往漏领的句签（历史达标日 + 当日句签已就绪；幂等，重复调用不重复发）",
        "operationId": "post__api_client_users__id_sentence_cards_backfill",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-users/{id}/sentence-cards/grant": {
      "post": {
        "tags": [
          "客户端用户"
        ],
        "summary": "一键解锁指定句签（幂等；重复解锁返回 alreadyOwned=true）",
        "operationId": "post__api_client_users__id_sentence_cards_grant",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-users/{id}/password": {
      "put": {
        "tags": [
          "客户端用户"
        ],
        "summary": "重置密码（同时强制下线）",
        "operationId": "put__api_client_users__id_password",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client-users/{id}/status": {
      "put": {
        "tags": [
          "客户端用户"
        ],
        "summary": "启用 / 禁用",
        "operationId": "put__api_client_users__id_status",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/checkin/today": {
      "get": {
        "tags": [
          "每日打卡"
        ],
        "summary": "今日进度",
        "operationId": "get__api_client_checkin_today",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/checkin": {
      "post": {
        "tags": [
          "每日打卡"
        ],
        "summary": "打卡（幂等；返回海报数据）",
        "operationId": "post__api_client_checkin",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/analytics/active-trend": {
      "get": {
        "tags": [
          "数据分析"
        ],
        "summary": "新增 / 日活趋势",
        "operationId": "get__api_analytics_active_trend",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/analytics/ai-budget": {
      "get": {
        "tags": [
          "数据分析"
        ],
        "summary": "今日 AI 预算状态（跨所有调用方的成本闸门）",
        "operationId": "get__api_analytics_ai_budget",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/analytics/ai-calls": {
      "get": {
        "tags": [
          "数据分析"
        ],
        "summary": "近 N 日 AI 调用统计",
        "operationId": "get__api_analytics_ai_calls",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/analytics/ai-logs": {
      "get": {
        "tags": [
          "数据分析"
        ],
        "summary": "AI 调用日志（分页）",
        "operationId": "get__api_analytics_ai_logs",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/analytics/ai-logs/summary": {
      "get": {
        "tags": [
          "数据分析"
        ],
        "summary": "AI 调用日志汇总（与列表同一套筛选）。 ⚠️ 必须声明在 `ai-logs` 之前不影响（两者都无参数段），但**必须在任何 `:param` 路由之前**",
        "operationId": "get__api_analytics_ai_logs_summary",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/analytics/answer-trend": {
      "get": {
        "tags": [
          "数据分析"
        ],
        "summary": "近 N 日答题趋势",
        "operationId": "get__api_analytics_answer_trend",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/analytics/category": {
      "get": {
        "tags": [
          "数据分析"
        ],
        "summary": "分类运营数据",
        "operationId": "get__api_analytics_category",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/analytics/checkin": {
      "get": {
        "tags": [
          "数据分析"
        ],
        "summary": "打卡统计",
        "operationId": "get__api_analytics_checkin",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/analytics/difficulty": {
      "get": {
        "tags": [
          "数据分析"
        ],
        "summary": "题目难度分布",
        "operationId": "get__api_analytics_difficulty",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/analytics/funnel": {
      "get": {
        "tags": [
          "数据分析"
        ],
        "summary": "留存漏斗（窗口内注册用户：注册 → 激活 → 打卡 → 领句签）",
        "operationId": "get__api_analytics_funnel",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/analytics/overview": {
      "get": {
        "tags": [
          "数据分析"
        ],
        "summary": "总览指标",
        "operationId": "get__api_analytics_overview",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/analytics/retention": {
      "get": {
        "tags": [
          "数据分析"
        ],
        "summary": "队列留存（按注册日的 D0/D1/D3/D7）",
        "operationId": "get__api_analytics_retention",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/questions/festivals": {
      "get": {
        "tags": [
          "刷题"
        ],
        "summary": "可选的节日题库列表（只含有就绪题目的节日；按节日日期倒序）",
        "operationId": "get__api_client_questions_festivals",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/questions/memory-galaxy": {
      "get": {
        "tags": [
          "刷题"
        ],
        "summary": "记忆星系：学过的句子按场景聚成星座，坐标为后端确定性生成（双端一致）",
        "operationId": "get__api_client_questions_memory_galaxy",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/questions/memory-stats": {
      "get": {
        "tags": [
          "刷题"
        ],
        "summary": "记忆健康概览（遗忘曲线 / 待复习分布可视化）",
        "operationId": "get__api_client_questions_memory_stats",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/questions/next": {
      "get": {
        "tags": [
          "刷题"
        ],
        "summary": "下一张卡（8:2 新题/复习混抽；不含答案）。 difficulty 仅作用于新题抽取；festival / categoryId 传了则只从对应题库抽（专门刷题， 两者互斥、festival 优先）。拼词词块**恒定下发**，便于客户端切换作答模式时无需重抽题",
        "operationId": "get__api_client_questions_next",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/questions/{id}/answer": {
      "post": {
        "tags": [
          "刷题"
        ],
        "summary": "提交答案（返回正确答案，用于翻转面）",
        "operationId": "post__api_client_questions__id_answer",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/questions/{id}/favorite": {
      "post": {
        "tags": [
          "刷题"
        ],
        "summary": "收藏 / 取消收藏",
        "operationId": "post__api_client_questions__id_favorite",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "刷题"
        ],
        "summary": "取消收藏（显式 DELETE，语义优先）",
        "operationId": "delete__api_client_questions__id_favorite",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/reports": {
      "get": {
        "tags": [
          "题库管理"
        ],
        "summary": "分页列表（筛选：status/reason/keyword）",
        "operationId": "get__api_reports",
        "parameters": [
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "reason",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "keyword",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences": {
      "get": {
        "tags": [
          "题库管理"
        ],
        "summary": "分页列表（筛选：status/categoryId/difficulty/keyword）",
        "operationId": "get__api_sentences",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "手工创建题目",
        "operationId": "post__api_sentences",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SaveSentenceDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/SaveSentenceDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/{id}": {
      "get": {
        "tags": [
          "题库管理"
        ],
        "summary": "详情",
        "operationId": "get__api_sentences__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "题库管理"
        ],
        "summary": "编辑题目",
        "operationId": "put__api_sentences__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SaveSentenceDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/SaveSentenceDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "题库管理"
        ],
        "summary": "下架题目（软删除）",
        "operationId": "delete__api_sentences__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/categories": {
      "get": {
        "tags": [
          "题库管理"
        ],
        "summary": "场景分类列表（含题目数）。 ⚠️ 必须声明在 `@Get(':id')` 之前：Nest 按声明顺序匹配，否则 `categories` 会被 `:id` 吃掉",
        "operationId": "get__api_sentences_categories",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "新增分类",
        "operationId": "post__api_sentences_categories",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SaveCategoryDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/SaveCategoryDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/export": {
      "get": {
        "tags": [
          "题库管理"
        ],
        "summary": "导出题库 CSV（流式；筛选与列表共用同一套条件）。 权限用 `sentence:query` 而不是新增 `sentence:export`：导出是只读操作， 且权限码是种子数据里写死的，为一个导出动作加码需要重跑 seed——收益不抵风险",
        "operationId": "get__api_sentences_export",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/gen-tasks": {
      "get": {
        "tags": [
          "题库管理"
        ],
        "summary": "生成批次列表（运营监控）。 ⚠️ 必须声明在 `@Get(':id')` 之前：Nest 按声明顺序匹配，否则 `gen-tasks` 会被 `:id` 吃掉， 触发 IdParamDto 校验 → 报「id 必须为正整数」（2026-10-24 真实缺陷：点「生成题库」后 前端紧接着拉批次列表，于是刚提示成功就弹出这个错）",
        "operationId": "get__api_sentences_gen_tasks",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/{id}/regenerate-image": {
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "单题重新生图（异步，立即返回）。 权限沿用 `sentence:gen`：会消耗 AI 生图配额，与「生成题库」同属生成类操作， 为一个按钮新增权限码还得重跑 seed，不划算。 生图要 10~40 秒，超过管理端 15 秒请求超时，所以这里只负责受理",
        "operationId": "post__api_sentences__id_regenerate_image",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RegenerateImageDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/RegenerateImageDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/batch-regenerate-image": {
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "批量重新生图（异步，立即返回；单题接口的批量版，换配图风格时用）。 与批量上下架不同，这里**不要求全部成功**：单题不存在、正在生成中、已有生图 任务在跑的会被跳过并在响应里回给前端，其余题照常受理",
        "operationId": "post__api_sentences_batch_regenerate_image",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/BatchRegenerateImageDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/BatchRegenerateImageDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/batch-status": {
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "批量上下架（运营清理题库用；上架只对已有配图的题生效）",
        "operationId": "post__api_sentences_batch_status",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/BatchSentenceStatusDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/BatchSentenceStatusDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/explanation/backfill": {
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "补全存量题解析（管理端手动、按批）。 为什么不用定时任务自动跑：现存题量上千，全量补一遍要花不少 token； 该花多少、什么时候花应由运营决定。每批返回 scanned/updated/remaining， 运营看着 remaining 点到 0 即可",
        "operationId": "post__api_sentences_explanation_backfill",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/BackfillExplanationDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/BackfillExplanationDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/gen-tasks/{id}/cancel": {
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "取消批次（终态 cancelled，之后可删除）",
        "operationId": "post__api_sentences_gen_tasks__id_cancel",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/gen-tasks/{id}/pause": {
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "暂停批次（在下一个批次边界生效，最长等一个批次，约 1~2 分钟）",
        "operationId": "post__api_sentences_gen_tasks__id_pause",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/gen-tasks/{id}/resume": {
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "继续批次（从已完成进度接着跑，不会重复生成）",
        "operationId": "post__api_sentences_gen_tasks__id_resume",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/gen/batch": {
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "手动触发批量生成（异步执行，进度看批次列表）。 传 difficulty 则本批全部出该难度（定向补某一档）；传 categoryName 则本批全部归属该场景 （定向填某一场景）。两者都省略则按自然分布跨所有启用分类",
        "operationId": "post__api_sentences_gen_batch",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/TriggerGenDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/TriggerGenDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/gen/festival": {
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "手动触发「今天的节日题库」（运营补跑 / 测试用；非节日返回 400）。 与定时任务同一条链路：新一期生成成功后，同一节日的旧题整体退场",
        "operationId": "post__api_sentences_gen_festival",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/gen/festival-covers": {
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "为全年所有节日生成**专属封面图**。 与「生成节日题库」一样是**即发即忘**：二十来张图串行生成要十几分钟， 管理端 axios 超时只有 15 秒，同步返回必然超时。所以立即返回「已启动」， 进度通过题库页的封面出没来判断。 已有封面的节日默认跳过（不覆盖）；force=true 时强制重画（换掉不贴合的封面）",
        "operationId": "post__api_sentences_gen_festival_covers",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/gen/festivals": {
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "手动触发「全部节日题库」的一次性生成（首次铺库 / 换年后补齐）。 节日题库是**常驻内容库**：一次铺满全年所有节日，用户端随时都能看到 所有节日并专门刷题，而不是只有节日当天才有题可选。 只补题量不足的节日，已就绪的会跳过（不重生成，免得把用户正在刷的题换掉）",
        "operationId": "post__api_sentences_gen_festivals",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/word-meanings/backfill": {
      "post": {
        "tags": [
          "题库管理"
        ],
        "summary": "补全存量题逐词释义（管理端手动、按批；拼词模式悬浮词义用）。 与解析回填同一取舍：全量补一遍要花不少 token，由运营决定什么时候花、花多少。 默认补「还没有词义」的题；force=true 重生成「已有词义」的题（模型升级后刷新口径）。 每批返回 scanned/updated/remaining（remaining 恒为「缺词义」的题数，便于点到 0）",
        "operationId": "post__api_sentences_word_meanings_backfill",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/BackfillWordMeaningsDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/BackfillWordMeaningsDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/reports/{id}": {
      "put": {
        "tags": [
          "题库管理"
        ],
        "summary": "处理举报（标记已处理/已驳回 + 备注）",
        "operationId": "put__api_reports__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/HandleReportDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/HandleReportDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/categories/{id}": {
      "put": {
        "tags": [
          "题库管理"
        ],
        "summary": "编辑分类",
        "operationId": "put__api_sentences_categories__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SaveCategoryDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/SaveCategoryDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "题库管理"
        ],
        "summary": "删除分类（有题目引用时拒绝）",
        "operationId": "delete__api_sentences_categories__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sentences/gen-tasks/{id}": {
      "delete": {
        "tags": [
          "题库管理"
        ],
        "summary": "删除批次（保留已配图题目，只清理未生成配图的题目；运行中的批次会在当前批次边界停下）",
        "operationId": "delete__api_sentences_gen_tasks__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/report": {
      "post": {
        "tags": [
          "题目举报"
        ],
        "summary": "提交举报/反馈",
        "operationId": "post__api_client_report",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/feedback/mine": {
      "get": {
        "tags": [
          "用户反馈"
        ],
        "summary": "我的反馈（含处理状态与运营回复）",
        "operationId": "get__api_client_feedback_mine",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/feedback": {
      "post": {
        "tags": [
          "用户反馈"
        ],
        "summary": "提交产品反馈（文本 + 最多 5 张图片，multipart）",
        "operationId": "post__api_client_feedback",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/mail-settings": {
      "get": {
        "tags": [
          "邮件设置"
        ],
        "summary": "读取设置（密钥只回掩码）",
        "operationId": "get__api_mail_settings",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "邮件设置"
        ],
        "summary": "保存设置（secretKey 传空 = 不修改）",
        "operationId": "put__api_mail_settings",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateMailSettingsDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateMailSettingsDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/mail-settings/test": {
      "post": {
        "tags": [
          "邮件设置"
        ],
        "summary": "发送测试邮件（用验证码模板发一条，验证凭证/模板/域名是否都配好）",
        "operationId": "post__api_mail_settings_test",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/TestMailDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/TestMailDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/favorites": {
      "get": {
        "tags": [
          "语句库"
        ],
        "summary": "收藏夹（分页）",
        "operationId": "get__api_client_favorites",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/history": {
      "get": {
        "tags": [
          "语句库"
        ],
        "summary": "学习记录（全量历史：全部/错题/对题 + 难度/场景/时间范围筛选）",
        "operationId": "get__api_client_history",
        "parameters": [
          {
            "name": "type",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/review": {
      "get": {
        "tags": [
          "语句库"
        ],
        "summary": "复习池（分页：答错且到期的题）",
        "operationId": "get__api_client_review",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/ai-settings": {
      "get": {
        "tags": [
          "AI 设置"
        ],
        "summary": "读取设置（API Key 只回掩码）",
        "operationId": "get__api_ai_settings",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "AI 设置"
        ],
        "summary": "保存设置（apiKey 传空 = 不修改）",
        "operationId": "put__api_ai_settings",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateAiSettingsDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateAiSettingsDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/ai-settings/test": {
      "post": {
        "tags": [
          "AI 设置"
        ],
        "summary": "测试连通性：用指定通道发一个极短的请求。 `channel=nim` 时测英伟达 NIM 生题通道（地址/密钥/模型回落到全局 Agnes 对应项）； 缺省测全局生文模型。只测文本模型（生图一次成本高、耗时数十秒，不适合做「点一下试试」）。 失败时把上游状态码与前 200 字回包透出，便于定位 key/地址/模型哪个错了",
        "operationId": "post__api_ai_settings_test",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/ai/quota": {
      "get": {
        "tags": [
          "AI 拓展"
        ],
        "summary": "今日 AI 额度（前端展示「剩余 N 次」并在用尽前置灰按钮）",
        "operationId": "get__api_client_ai_quota",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/ai/analyze": {
      "post": {
        "tags": [
          "AI 拓展"
        ],
        "summary": "题目解析：答题后无论对错都给出语法与关键词形态的讲解（SSE）",
        "operationId": "post__api_client_ai_analyze",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/ai/expand": {
      "post": {
        "tags": [
          "AI 拓展"
        ],
        "summary": "场景延展造句（SSE）",
        "operationId": "post__api_client_ai_expand",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/ai/word-root": {
      "post": {
        "tags": [
          "AI 拓展"
        ],
        "summary": "词根词缀拆解（SSE）",
        "operationId": "post__api_client_ai_word_root",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/app-versions": {
      "get": {
        "tags": [
          "App 版本"
        ],
        "summary": "分页列表（筛选 platform / status / keyword）",
        "operationId": "get__api_app_versions",
        "parameters": [
          {
            "name": "platform",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "keyword",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "App 版本"
        ],
        "summary": "新增版本",
        "operationId": "post__api_app_versions",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SaveAppVersionDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/SaveAppVersionDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/app-versions/upload": {
      "post": {
        "tags": [
          "App 版本"
        ],
        "summary": "上传安装包（.apk，≤200MB）。 单独一个入口而不是复用 `/files/upload`：那份配置限制 10MB、白名单是\"业务附件\"， 安装包过不去；这里只收 .apk 且上限 200MB（配 APK_MULTER_OPTIONS）",
        "operationId": "post__api_app_versions_upload",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/app-versions/{id}": {
      "put": {
        "tags": [
          "App 版本"
        ],
        "summary": "编辑版本",
        "operationId": "put__api_app_versions__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SaveAppVersionDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/SaveAppVersionDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "App 版本"
        ],
        "summary": "删除版本记录（物理安装包由「文件管理」统一清理）",
        "operationId": "delete__api_app_versions__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/app-versions/{id}/status": {
      "put": {
        "tags": [
          "App 版本"
        ],
        "summary": "上下架",
        "operationId": "put__api_app_versions__id_status",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AppVersionStatusDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/AppVersionStatusDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/ip-ban": {
      "get": {
        "tags": [
          "IP黑名单"
        ],
        "summary": "封禁记录分页列表",
        "operationId": "get__api_ip_ban",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "IP黑名单"
        ],
        "summary": "人工封禁 IP",
        "operationId": "post__api_ip_ban",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/ip-ban/stats": {
      "get": {
        "tags": [
          "IP黑名单"
        ],
        "summary": "概览统计",
        "operationId": "get__api_ip_ban_stats",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/ip-ban/{ip}": {
      "delete": {
        "tags": [
          "IP黑名单"
        ],
        "summary": "解封 IP",
        "operationId": "delete__api_ip_ban__ip",
        "parameters": [
          {
            "name": "ip",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 ip"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/client/leaderboard": {
      "get": {
        "tags": [
          "Leaderboard"
        ],
        "summary": "排行榜：type=today_* / week_* / month_*（今日、近 7 天、近 30 天答题/答对前 100）、 checkin_total（累计打卡天数前 100）。响应附带当前用户名次 me（未上榜为 null）。 名次型成就（榜上有名 / 十强之列 / 三甲之列 / 榜首加冕）在这里旁路解锁：名次只有查榜单 时才算得出来，答题路径不做全表聚合；仅进入前 100 才触发，且由 GamifyService 在勋章 集齐后短路，避免每次看榜都白跑一遍",
        "operationId": "get__api_client_leaderboard",
        "parameters": [
          {
            "name": "type",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string",
              "description": "榜单类型（必填）",
              "example": "示例值"
            },
            "description": "榜单类型（必填）"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    },
    "schemas": {
      "LoginDto": {
        "type": "object",
        "properties": {
          "username": {
            "type": "string",
            "description": "登录账号",
            "example": "admin"
          },
          "password": {
            "type": "string",
            "description": "明文密码",
            "example": "123456"
          },
          "captchaId": {
            "type": "string",
            "description": "验证码 id（验证码启用时必填，由前端从 /auth/captcha 获取）",
            "example": "b7f3c1a2-0000-4a1b-9c3d-8e6f5a4b3c2d"
          },
          "captchaCode": {
            "type": "string",
            "description": "用户输入的验证码",
            "example": "A1B2"
          }
        },
        "required": [
          "username",
          "password"
        ]
      },
      "RefreshDto": {
        "type": "object",
        "properties": {
          "refreshToken": {
            "type": "string",
            "description": "刷新令牌（refreshToken）",
            "example": "<登录返回的 refreshToken>"
          }
        },
        "required": [
          "refreshToken"
        ]
      },
      "CreateUserDto": {
        "type": "object",
        "properties": {
          "username": {
            "type": "string",
            "description": "登录账号：3~20 位字母/数字/下划线",
            "example": "admin"
          },
          "password": {
            "type": "string",
            "description": "明文密码：长度与复杂度统一由 common/auth/password-policy.ts 决定",
            "example": "123456"
          },
          "nickname": {
            "type": "string",
            "description": "昵称",
            "example": "示例用户"
          },
          "email": {
            "type": "string",
            "description": "邮箱（可空）",
            "example": "demo@example.com"
          },
          "phone": {
            "type": "string",
            "description": "手机号（可空）",
            "example": "13800138000"
          },
          "gender": {
            "type": "string",
            "description": "性别（字典 sys_user_sex 的值，可空）",
            "example": "1"
          },
          "status": {
            "type": "number",
            "description": "状态：1 启用 / 0 禁用，默认 1",
            "example": 1
          },
          "roleIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "角色 id 列表，默认空",
            "example": [
              1
            ]
          },
          "deptId": {
            "type": "number",
            "description": "部门 id（0 表示未分配），默认 0",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注（可空）",
            "example": "示例备注"
          }
        },
        "required": [
          "username",
          "password",
          "nickname"
        ]
      },
      "UpdateUserDto": {
        "type": "object",
        "properties": {
          "nickname": {
            "type": "string",
            "description": "昵称",
            "example": "示例用户"
          },
          "email": {
            "type": "string",
            "description": "邮箱（可空）",
            "example": "demo@example.com"
          },
          "phone": {
            "type": "string",
            "description": "手机号（可空）",
            "example": "13800138000"
          },
          "gender": {
            "type": "string",
            "description": "性别（可空）",
            "example": "1"
          },
          "status": {
            "type": "number",
            "description": "状态：1 启用 / 0 禁用，默认 1",
            "example": 1
          },
          "roleIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "角色 id 列表，默认空",
            "example": [
              1
            ]
          },
          "deptId": {
            "type": "number",
            "description": "部门 id（0 表示未分配），默认 0",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注（可空）",
            "example": "示例备注"
          }
        },
        "required": [
          "nickname"
        ]
      },
      "AssignUserMenuDto": {
        "type": "object",
        "properties": {
          "menuIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "example": [
              1
            ]
          }
        }
      },
      "ResetPasswordDto": {
        "type": "object",
        "properties": {
          "password": {
            "type": "string",
            "example": "123456"
          }
        },
        "required": [
          "password"
        ]
      },
      "AssignRoleDto": {
        "type": "object",
        "properties": {
          "roleIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "example": [
              1
            ]
          }
        }
      },
      "StatusDto": {
        "type": "object",
        "properties": {
          "status": {
            "type": "number",
            "example": 1
          }
        },
        "required": [
          "status"
        ]
      },
      "IdsBodyDto": {
        "type": "object",
        "properties": {
          "ids": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "example": []
          }
        },
        "required": [
          "ids"
        ]
      },
      "CreateRoleDto": {
        "type": "object",
        "properties": {
          "roleName": {
            "type": "string",
            "example": "示例角色"
          },
          "roleCode": {
            "type": "string",
            "example": "demo_role"
          },
          "sort": {
            "type": "number",
            "example": 1
          },
          "status": {
            "type": "number",
            "example": 1
          },
          "dataScope": {
            "type": "number",
            "description": "数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人",
            "example": 1
          },
          "deptIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "自定义部门 id 列表（dataScope=2 时生效）",
            "example": [
              1
            ]
          },
          "remark": {
            "type": "string",
            "example": "示例备注"
          }
        },
        "required": [
          "roleName",
          "roleCode"
        ]
      },
      "ResetRoleMenusDto": {
        "type": "object",
        "properties": {
          "roleIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "目标角色 id；不传 / 传空数组 = 全部种子角色",
            "example": [
              1
            ]
          }
        }
      },
      "UpdateRoleDto": {
        "type": "object",
        "properties": {
          "roleName": {
            "type": "string",
            "example": "示例角色"
          },
          "sort": {
            "type": "number",
            "example": 1
          },
          "status": {
            "type": "number",
            "example": 1
          },
          "dataScope": {
            "type": "number",
            "description": "数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人",
            "example": 1
          },
          "deptIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "自定义部门 id 列表（dataScope=2 时生效）",
            "example": [
              1
            ]
          },
          "remark": {
            "type": "string",
            "example": "示例备注"
          }
        },
        "required": [
          "roleName"
        ]
      },
      "AssignMenuDto": {
        "type": "object",
        "properties": {
          "menuIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "example": [
              1
            ]
          }
        }
      },
      "MenuUpsertDto": {
        "type": "object",
        "properties": {
          "parentId": {
            "type": "number",
            "example": 1
          },
          "menuName": {
            "type": "string",
            "example": "示例菜单"
          },
          "menuType": {
            "type": "string",
            "example": "C"
          },
          "path": {
            "type": "string",
            "example": "示例值"
          },
          "component": {
            "type": "string",
            "example": "示例值"
          },
          "icon": {
            "type": "string",
            "example": "示例值"
          },
          "permission": {
            "type": "string",
            "example": "示例值"
          },
          "sort": {
            "type": "number",
            "example": 1
          },
          "visible": {
            "type": "number",
            "example": 1
          },
          "status": {
            "type": "number",
            "example": 1
          },
          "redirect": {
            "type": "string",
            "example": "示例值"
          },
          "keepAlive": {
            "type": "number",
            "example": 1
          }
        },
        "required": [
          "menuName",
          "menuType"
        ]
      },
      "CreateDictItemDto": {
        "type": "object",
        "properties": {
          "dictType": {
            "type": "string",
            "description": "所属字典类型编码",
            "example": "sys_demo"
          },
          "dictLabel": {
            "type": "string",
            "description": "字典标签（展示文案）",
            "example": "示例标签"
          },
          "dictValue": {
            "type": "string",
            "description": "字典值（业务存储值）",
            "example": "1"
          },
          "sort": {
            "type": "number",
            "description": "排序",
            "example": 1
          },
          "status": {
            "type": "number",
            "description": "状态：1 启用 / 0 禁用",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注",
            "example": "示例备注"
          }
        },
        "required": [
          "dictType",
          "dictLabel",
          "dictValue"
        ]
      },
      "CreateDictTypeDto": {
        "type": "object",
        "properties": {
          "dictName": {
            "type": "string",
            "description": "字典名称",
            "example": "示例字典"
          },
          "dictType": {
            "type": "string",
            "description": "字典类型编码（业务引用键，创建后不可修改）",
            "example": "sys_demo"
          },
          "status": {
            "type": "number",
            "description": "状态：1 启用 / 0 禁用",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注",
            "example": "示例备注"
          }
        },
        "required": [
          "dictName",
          "dictType"
        ]
      },
      "UpdateDictItemDto": {
        "type": "object",
        "properties": {
          "dictLabel": {
            "type": "string",
            "description": "字典标签（展示文案）",
            "example": "示例标签"
          },
          "dictValue": {
            "type": "string",
            "description": "字典值（业务存储值）",
            "example": "1"
          },
          "sort": {
            "type": "number",
            "description": "排序",
            "example": 1
          },
          "status": {
            "type": "number",
            "description": "状态：1 启用 / 0 禁用",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注",
            "example": "示例备注"
          }
        },
        "required": [
          "dictLabel",
          "dictValue"
        ]
      },
      "SetStatusDto": {
        "type": "object",
        "properties": {
          "status": {
            "type": "number",
            "description": "目标状态：1 启用 / 0 禁用",
            "example": 1
          }
        },
        "required": [
          "status"
        ]
      },
      "UpdateDictTypeDto": {
        "type": "object",
        "properties": {
          "dictName": {
            "type": "string",
            "description": "字典名称",
            "example": "示例字典"
          },
          "status": {
            "type": "number",
            "description": "状态：1 启用 / 0 禁用",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注",
            "example": "示例备注"
          }
        },
        "required": [
          "dictName"
        ]
      },
      "CreateConfigDto": {
        "type": "object",
        "properties": {
          "configName": {
            "type": "string",
            "description": "参数名称",
            "example": "示例参数"
          },
          "configKey": {
            "type": "string",
            "description": "参数键名（业务引用键，创建后不可修改）",
            "example": "sys.demo.key"
          },
          "configValue": {
            "type": "string",
            "description": "参数值",
            "example": "示例值"
          },
          "remark": {
            "type": "string",
            "description": "备注",
            "example": "示例备注"
          }
        },
        "required": [
          "configName",
          "configKey"
        ]
      },
      "UpdateConfigDto": {
        "type": "object",
        "properties": {
          "configName": {
            "type": "string",
            "description": "参数名称",
            "example": "示例参数"
          },
          "configValue": {
            "type": "string",
            "description": "参数值",
            "example": "示例值"
          },
          "remark": {
            "type": "string",
            "description": "备注",
            "example": "示例备注"
          }
        },
        "required": [
          "configName"
        ]
      },
      "UploadBizDto": {
        "type": "object",
        "properties": {
          "bizType": {
            "type": "string",
            "description": "业务类型：模块标识，只允许字母/数字/下划线/连字符（避免塞入任意文本污染筛选）",
            "example": "示例值"
          },
          "bizId": {
            "type": "number",
            "description": "业务主键：表单里是字符串，需显式转数字后校验",
            "example": 1
          }
        }
      },
      "GenCreateDto": {
        "type": "object",
        "properties": {
          "overwrite": {
            "type": "boolean",
            "description": "同名文件已存在时是否覆盖（默认 false → 409 冲突）",
            "example": false
          }
        }
      },
      "GenConfigDto": {
        "type": "object",
        "properties": {
          "tableName": {
            "type": "string",
            "description": "数据库表名（必须真实存在）",
            "example": "sys_config"
          },
          "moduleName": {
            "type": "string",
            "description": "模块名（如 system）：字母开头，仅字母数字",
            "example": "demo"
          },
          "businessName": {
            "type": "string",
            "description": "业务名（如 user）：字母开头，仅字母数字，会拼进生成物路径",
            "example": "demo"
          },
          "author": {
            "type": "string",
            "description": "作者（写入文件头注释）",
            "example": "作者"
          },
          "isTree": {
            "type": "boolean",
            "description": "是否树形表：列表返回整棵树、不生成分页",
            "example": false
          },
          "treeParentField": {
            "type": "string",
            "description": "树形表父级字段名（默认 parentId）",
            "example": "示例值"
          },
          "columnOptions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/GenColumnOptionDto"
            },
            "description": "各字段的控件类型 / 字典绑定（按 columnName 合并）",
            "example": []
          }
        },
        "required": [
          "tableName",
          "moduleName",
          "businessName"
        ]
      },
      "GenColumnOptionDto": {
        "type": "object",
        "properties": {
          "columnName": {
            "type": "string",
            "description": "列名（下划线形式，与表结构探测结果对应）",
            "example": "示例值"
          },
          "htmlType": {
            "type": "string",
            "description": "控件类型：普通输入框 / 字典下拉 / 树形父级选择",
            "example": "示例值"
          },
          "dictType": {
            "type": "string",
            "description": "绑定的字典类型编码（htmlType=select 时必填，由服务校验）",
            "example": "sys_demo"
          }
        },
        "required": [
          "columnName",
          "htmlType"
        ]
      },
      "UpdateProfileDto": {
        "type": "object",
        "properties": {
          "nickname": {
            "type": "string",
            "example": "示例用户"
          },
          "email": {
            "type": "string",
            "description": "邮箱：空串或合法邮箱（空串表示清空）。",
            "example": "demo@example.com"
          },
          "phone": {
            "type": "string",
            "description": "手机号：空串或合法手机号。",
            "example": "13800138000"
          },
          "gender": {
            "type": "string",
            "description": "性别：空串或最多 20 字符。",
            "example": "1"
          },
          "avatar": {
            "type": "string",
            "description": "头像地址：最多 255 字符。",
            "example": "/static/2026/avatar.png"
          }
        },
        "required": [
          "nickname"
        ]
      },
      "ChangePasswordDto": {
        "type": "object",
        "properties": {
          "oldPassword": {
            "type": "string",
            "example": "123456"
          },
          "newPassword": {
            "type": "string",
            "example": "123456"
          }
        },
        "required": [
          "oldPassword",
          "newPassword"
        ]
      },
      "DeptUpsertDto": {
        "type": "object",
        "properties": {
          "parentId": {
            "type": "number",
            "example": 1
          },
          "deptType": {
            "type": "number",
            "description": "类型：1 部门 / 2 岗位（岗位为叶子节点，不能再挂下级）",
            "example": 1
          },
          "deptName": {
            "type": "string",
            "example": "示例部门"
          },
          "leader": {
            "type": "string",
            "example": "张三"
          },
          "phone": {
            "type": "string",
            "example": "13800138000"
          },
          "email": {
            "type": "string",
            "example": "demo@example.com"
          },
          "sort": {
            "type": "number",
            "example": 1
          },
          "status": {
            "type": "number",
            "example": 1
          }
        },
        "required": [
          "deptType",
          "deptName"
        ]
      },
      "AnalyzeWordDto": {
        "type": "object",
        "properties": {
          "word": {
            "type": "string",
            "example": "示例值"
          }
        },
        "required": [
          "word"
        ]
      },
      "UpdateWordRootDto": {
        "type": "object",
        "properties": {
          "phonetic": {
            "type": "string",
            "example": "示例值"
          },
          "meaning": {
            "type": "string",
            "example": "示例值"
          },
          "analysisJson": {
            "type": "string",
            "description": "结构化解析（JSON 字符串，形如 {\"parts\":[...],\"explanation\":\"\",\"related\":[]}）。 用字符串而非对象接收：白名单校验需要明确的形状，且前端用 JSON 文本域编辑。",
            "example": "示例值"
          }
        }
      },
      "GenerateSentenceCardDto": {
        "type": "object",
        "properties": {
          "bizDate": {
            "type": "string",
            "description": "业务日期（YYYY-MM-DD）",
            "example": "示例值"
          },
          "force": {
            "type": "boolean",
            "description": "已就绪时是否强制覆盖。 缺省按 true 处理——运营点「重新生成」的意图就是要换一张。",
            "example": true
          }
        },
        "required": [
          "bizDate"
        ]
      },
      "UpdateSentenceCardDto": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string",
            "example": "示例值"
          },
          "titleZh": {
            "type": "string",
            "example": "示例值"
          },
          "sentenceEn": {
            "type": "string",
            "example": "示例值"
          },
          "translationZh": {
            "type": "string",
            "example": "示例值"
          },
          "blessing": {
            "type": "string",
            "example": "示例值"
          }
        }
      },
      "HandleFeedbackDto": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "description": "处理结果：resolved 已处理 / dismissed 已驳回",
            "example": "示例值"
          },
          "reply": {
            "type": "string",
            "description": "给用户的回复（可选）。 **会下发用户端**——用户在「我的反馈」能看到，是「意见被听见」的闭环； 与内部备注 `handleNote` 分开，后者只给运营看。",
            "example": "示例值"
          },
          "handleNote": {
            "type": "string",
            "description": "内部处理备注（可选；**不下发**用户端）",
            "example": "示例值"
          }
        },
        "required": [
          "status"
        ]
      },
      "SaveSentenceDto": {
        "type": "object",
        "properties": {
          "categoryId": {
            "type": "number",
            "example": 1
          },
          "sentenceEn": {
            "type": "string",
            "example": "示例值"
          },
          "translationZh": {
            "type": "string",
            "example": "示例值"
          },
          "ipa": {
            "type": "string",
            "example": "示例值"
          },
          "explanation": {
            "type": "string",
            "example": "示例值"
          },
          "scenePrompt": {
            "type": "string",
            "example": "示例值"
          },
          "difficulty": {
            "type": "number",
            "example": 1
          },
          "status": {
            "type": "string",
            "example": "示例值"
          }
        },
        "required": [
          "categoryId",
          "sentenceEn",
          "translationZh"
        ]
      },
      "RegenerateImageDto": {
        "type": "object",
        "properties": {
          "scenePrompt": {
            "type": "string",
            "example": "示例值"
          }
        }
      },
      "BatchRegenerateImageDto": {
        "type": "object",
        "properties": {
          "ids": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "example": []
          }
        },
        "required": [
          "ids"
        ]
      },
      "BatchSentenceStatusDto": {
        "type": "object",
        "properties": {
          "ids": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "example": []
          },
          "status": {
            "type": "string",
            "example": "示例值"
          }
        },
        "required": [
          "ids",
          "status"
        ]
      },
      "SaveCategoryDto": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "分类名称（中文，唯一）",
            "example": "log-archive"
          },
          "nameEn": {
            "type": "string",
            "description": "英文名（客户端卡片副标题）",
            "example": "示例值"
          },
          "icon": {
            "type": "string",
            "description": "图标：**lucide 图标名**（不带前缀）。 Web 端拼 `i-lucide-*`、App 端查 `android/lib/theme/icon_map.dart`， 所以名字必须是 lucide 里真实存在的，否则 Web 端会画不出图标。",
            "example": "示例值"
          },
          "sort": {
            "type": "number",
            "description": "排序（升序）",
            "example": 1
          },
          "status": {
            "type": "number",
            "description": "1 启用 / 0 禁用",
            "example": 1
          }
        },
        "required": [
          "name"
        ]
      },
      "BackfillExplanationDto": {
        "type": "object",
        "properties": {
          "limit": {
            "type": "number",
            "description": "本批补多少条（缺省 20，上限 100）。 上限刻意压得低：一次补太多会长时间占用上游配额并逼近请求超时， 分批点几次更可控，接口每次都返回剩余条数。",
            "example": 1
          },
          "force": {
            "type": "boolean",
            "description": "是否重新生成已有解析（缺省 false）。 true = 把「不是新三行格式」的旧解析也重新生成（空值 + 旧的冗长解析）， 用于把历史内容统一精简成固定格式；补完即收敛，可反复点到 remaining=0。",
            "example": true
          }
        }
      },
      "TriggerGenDto": {
        "type": "object",
        "properties": {
          "count": {
            "type": "number",
            "description": "本次目标数量（缺省取配置 SENTENCE_DAILY_TARGET）",
            "example": 1
          },
          "difficulty": {
            "type": "number",
            "description": "强制本批全部为该难度（1 易 / 2 中 / 3 难；省略则按 40/40/20 自然分布）。 用于「某一档题目不够用」时定向补题，例如基础档被抽空。",
            "example": 1
          },
          "categoryName": {
            "type": "string",
            "description": "定向补的场景分类名（中文，须为启用分类；省略则按自然分布跨所有启用分类）。 用于把某个 0 题的新场景填起来：本批所有题强制归属该分类，模型自报的分类名会被服务端覆盖。",
            "example": "示例值"
          }
        }
      },
      "BackfillWordMeaningsDto": {
        "type": "object",
        "properties": {
          "limit": {
            "type": "number",
            "description": "本批补多少条（缺省 20，上限 100）。 上限刻意压得低：一次补太多会长时间占用上游配额并逼近请求超时， 分批点几次更可控，接口每次都返回剩余条数。",
            "example": 1
          },
          "force": {
            "type": "boolean",
            "description": "是否重新生成已有词义（缺省 false）。 true = 连已生成过释义的题一起重新生成（用于模型升级后统一刷新口径）， 可反复点到 remaining=0。",
            "example": true
          }
        }
      },
      "HandleReportDto": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "description": "处理结果：resolved 已处理 / dismissed 已驳回",
            "example": "示例值"
          },
          "handleNote": {
            "type": "string",
            "description": "处理备注（可选）",
            "example": "示例值"
          }
        },
        "required": [
          "status"
        ]
      },
      "TestMailDto": {
        "type": "object",
        "properties": {
          "to": {
            "type": "string",
            "example": "示例值"
          }
        },
        "required": [
          "to"
        ]
      },
      "UpdateMailSettingsDto": {
        "type": "object",
        "properties": {
          "enabled": {
            "type": "boolean",
            "description": "总开关",
            "example": true
          },
          "secretId": {
            "type": "string",
            "example": "示例值"
          },
          "secretKey": {
            "type": "string",
            "description": "留空 = 保持原密钥不变",
            "example": "示例值"
          },
          "region": {
            "type": "string",
            "example": "示例值"
          },
          "fromAddress": {
            "type": "string",
            "example": "示例值"
          },
          "fromAlias": {
            "type": "string",
            "example": "示例值"
          },
          "templateCaptcha": {
            "type": "number",
            "example": 1
          },
          "templateReminder": {
            "type": "number",
            "example": 1
          }
        },
        "required": [
          "enabled"
        ]
      },
      "UpdateAiSettingsDto": {
        "type": "object",
        "properties": {
          "apiKey": {
            "type": "string",
            "description": "Agnes API Key（留空 = 不修改）",
            "example": "示例值"
          },
          "baseUrl": {
            "type": "string",
            "description": "上游地址（含 /v1；留空 = 不修改）",
            "example": "示例值"
          },
          "textModel": {
            "type": "string",
            "description": "生文模型（留空 = 不修改）",
            "example": "示例值"
          },
          "imageModel": {
            "type": "string",
            "description": "生图模型（留空 = 不修改）",
            "example": "示例值"
          },
          "nimBaseUrl": {
            "type": "string",
            "description": "英伟达 NIM 生题通道 - 上游地址（留空 = 不修改；填了即启用 NIM 通道，需与 nimApiKey / nimModel 一起填）。 默认 `https://integrate.api.nvidia.com/v1`（OpenAI 兼容）。",
            "example": "示例值"
          },
          "nimApiKey": {
            "type": "string",
            "description": "英伟达 NIM 生题通道 - API Key（留空 = 不修改；与 nimBaseUrl / nimModel 一起生效）",
            "example": "示例值"
          },
          "nimModel": {
            "type": "string",
            "description": "英伟达 NIM 生题通道 - 模型名（留空 = 不修改；非空即启用通道，仅生题内容生成走 NIM）",
            "example": "示例值"
          },
          "genChannel": {
            "type": "string",
            "description": "生题内容生成通道选择：'agnes'（默认，走全局生文模型）或 'nim'（走 NIM 通道，需 nim 三件套齐备）。 这是显式开关——两套配置可同时存在，由本字段决定生题走哪条。",
            "example": "示例值"
          }
        }
      },
      "SaveAppVersionDto": {
        "type": "object",
        "properties": {
          "platform": {
            "type": "string",
            "description": "平台（当前只做 android；ios 预留）",
            "example": "示例值"
          },
          "version": {
            "type": "string",
            "description": "版本名（展示用，如 1.2.0）",
            "example": "示例值"
          },
          "versionCode": {
            "type": "number",
            "description": "版本序号（Android versionCode，越大越新）",
            "example": 1
          },
          "fileId": {
            "type": "number",
            "description": "安装包文件 id（先调专用上传接口拿到）",
            "example": 1
          },
          "fileSize": {
            "type": "number",
            "description": "安装包大小（字节；不传则由文件记录兜底）",
            "example": 1
          },
          "changelog": {
            "type": "string",
            "description": "更新说明（多行文本）",
            "example": "示例值"
          },
          "forceUpdate": {
            "type": "number",
            "description": "是否强制更新：1 是 / 0 否",
            "example": 1
          },
          "status": {
            "type": "number",
            "description": "状态：1 上架 / 0 下架",
            "example": 1
          }
        },
        "required": [
          "version",
          "versionCode",
          "fileId"
        ]
      },
      "AppVersionStatusDto": {
        "type": "object",
        "properties": {
          "status": {
            "type": "number",
            "example": 1
          }
        },
        "required": [
          "status"
        ]
      }
    }
  }
};
