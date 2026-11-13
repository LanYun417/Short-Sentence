/**
 * 种子数据。
 * 模块职责：把默认菜单 / 角色 / 用户 / 字典 / 系统参数幂等写入数据库，并执行两条
 * 「既有库自愈」的数据归一（废弃系统参数清理、菜单图标名归一化）。
 *
 * 职责边界：
 * - 建表与列变更由 `prisma db push` 按 schema 统一完成（见 prisma/schema/ 各文件），本文件不承担 DDL；
 * - 本文件只负责**数据**：默认数据的幂等写入与存量数据的收敛。
 *
 * 执行时机：
 * - 服务启动时由 SeedService 的 onApplicationBootstrap 自动执行，早于 app.listen；
 * - 也可手动执行：`npm run seed`（入口见 prisma/seed.ts）。
 */
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { DataScope, MenuType, Status, SUPER_ADMIN_ROLE } from '../common/config/constants.js';
import { hashPassword } from '../common/utils/utils.js';
import { CHAIN_TOPIC_SEEDS } from '../modules/client/chain/chain-topics.js';
import { IPA_PHONEME_SEEDS } from '../modules/client/ipa/ipa-seeds.js';
import { AI_CONFIG_KEYS, LEGACY_AI_CONFIG_KEYS } from '../common/ai/ai.constants.js';
import { PrismaService } from './prisma.service.js';

/** 日志上下文（种子各步骤共用）。 */
const logger = new Logger('Seed');

/* --------------------------------- 菜单种子 -------------------------------- */

/** 菜单种子节点定义。 */
interface MenuSeedNode {
  key: string;
  menuName: string;
  menuType: MenuType;
  path?: string;
  component?: string;
  icon?: string;
  permission?: string;
  sort: number;
  visible?: number;
  status?: number;
  redirect?: string;
  keepAlive?: number;
  children?: MenuSeedNode[];
}

/** 完整菜单树定义（目录 M / 菜单 C / 按钮 F）。 */
const MENU_TREE: MenuSeedNode[] = [
  {
    key: 'dashboard',
    menuName: '首页',
    menuType: MenuType.MENU,
    path: '/home',
    component: 'home/index',
    icon: 'speedometer2',
    sort: 1,
    visible: Status.ENABLED,
    keepAlive: 1,
  },
  {
    key: 'system',
    menuName: '系统管理',
    menuType: MenuType.DIRECTORY,
    path: '/system',
    icon: 'gear',
    sort: 2,
    visible: Status.ENABLED,
    redirect: '/system/user',
    children: [
      {
        key: 'system:user',
        menuName: '用户管理',
        menuType: MenuType.MENU,
        path: '/system/user',
        component: 'system/user/index',
        icon: 'person',
        permission: 'system:user:list',
        sort: 1,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:user:query',
            menuName: '查询用户',
            menuType: MenuType.BUTTON,
            permission: 'system:user:query',
            sort: 1,
          },
          {
            key: 'system:user:add',
            menuName: '新增用户',
            menuType: MenuType.BUTTON,
            permission: 'system:user:add',
            sort: 2,
          },
          {
            key: 'system:user:edit',
            menuName: '编辑用户',
            menuType: MenuType.BUTTON,
            permission: 'system:user:edit',
            sort: 3,
          },
          {
            key: 'system:user:remove',
            menuName: '删除用户',
            menuType: MenuType.BUTTON,
            permission: 'system:user:remove',
            sort: 4,
          },
          {
            key: 'system:user:resetPwd',
            menuName: '重置密码',
            menuType: MenuType.BUTTON,
            permission: 'system:user:resetPwd',
            sort: 5,
          },
          {
            key: 'system:user:assignRole',
            menuName: '分配角色',
            menuType: MenuType.BUTTON,
            permission: 'system:user:assignRole',
            sort: 6,
          },
          {
            key: 'system:user:assignPerm',
            menuName: '额外权限',
            menuType: MenuType.BUTTON,
            permission: 'system:user:assignPerm',
            sort: 7,
          },
        ],
      },
      {
        key: 'system:role',
        menuName: '角色管理',
        menuType: MenuType.MENU,
        path: '/system/role',
        component: 'system/role/index',
        icon: 'shield-check',
        permission: 'system:role:list',
        sort: 2,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:role:query',
            menuName: '查询角色',
            menuType: MenuType.BUTTON,
            permission: 'system:role:query',
            sort: 1,
          },
          {
            key: 'system:role:add',
            menuName: '新增角色',
            menuType: MenuType.BUTTON,
            permission: 'system:role:add',
            sort: 2,
          },
          {
            key: 'system:role:edit',
            menuName: '编辑角色',
            menuType: MenuType.BUTTON,
            permission: 'system:role:edit',
            sort: 3,
          },
          {
            key: 'system:role:remove',
            menuName: '删除角色',
            menuType: MenuType.BUTTON,
            permission: 'system:role:remove',
            sort: 4,
          },
          {
            key: 'system:role:assignMenu',
            menuName: '授权菜单',
            menuType: MenuType.BUTTON,
            permission: 'system:role:assignMenu',
            sort: 5,
          },
          {
            key: 'system:role:all',
            menuName: '角色下拉',
            menuType: MenuType.BUTTON,
            permission: 'system:role:all',
            sort: 6,
          },
        ],
      },
      {
        key: 'system:menu',
        menuName: '菜单管理',
        menuType: MenuType.MENU,
        path: '/system/menu',
        component: 'system/menu/index',
        icon: 'list',
        permission: 'system:menu:list',
        sort: 3,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:menu:query',
            menuName: '查询菜单',
            menuType: MenuType.BUTTON,
            permission: 'system:menu:query',
            sort: 1,
          },
          {
            key: 'system:menu:add',
            menuName: '新增菜单',
            menuType: MenuType.BUTTON,
            permission: 'system:menu:add',
            sort: 2,
          },
          {
            key: 'system:menu:edit',
            menuName: '编辑菜单',
            menuType: MenuType.BUTTON,
            permission: 'system:menu:edit',
            sort: 3,
          },
          {
            key: 'system:menu:remove',
            menuName: '删除菜单',
            menuType: MenuType.BUTTON,
            permission: 'system:menu:remove',
            sort: 4,
          },
        ],
      },
      {
        key: 'system:dict',
        menuName: '字典管理',
        menuType: MenuType.MENU,
        path: '/system/dict',
        component: 'system/dict/index',
        icon: 'tags',
        permission: 'system:dict:list',
        sort: 4,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:dict:add',
            menuName: '新增字典',
            menuType: MenuType.BUTTON,
            permission: 'system:dict:add',
            sort: 1,
          },
          {
            key: 'system:dict:edit',
            menuName: '编辑字典',
            menuType: MenuType.BUTTON,
            permission: 'system:dict:edit',
            sort: 2,
          },
          {
            key: 'system:dict:remove',
            menuName: '删除字典',
            menuType: MenuType.BUTTON,
            permission: 'system:dict:remove',
            sort: 3,
          },
        ],
      },
      {
        key: 'system:dept',
        menuName: '部门/岗位管理',
        menuType: MenuType.MENU,
        path: '/system/dept',
        component: 'system/dept/index',
        icon: 'diagram-3',
        permission: 'system:dept:list',
        sort: 5,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:dept:query',
            menuName: '查询',
            menuType: MenuType.BUTTON,
            permission: 'system:dept:query',
            sort: 1,
          },
          {
            key: 'system:dept:add',
            menuName: '新增',
            menuType: MenuType.BUTTON,
            permission: 'system:dept:add',
            sort: 2,
          },
          {
            key: 'system:dept:edit',
            menuName: '编辑',
            menuType: MenuType.BUTTON,
            permission: 'system:dept:edit',
            sort: 3,
          },
          {
            key: 'system:dept:remove',
            menuName: '删除',
            menuType: MenuType.BUTTON,
            permission: 'system:dept:remove',
            sort: 4,
          },
        ],
      },
      {
        key: 'system:task',
        menuName: '定时任务',
        menuType: MenuType.MENU,
        path: '/system/task',
        component: 'system/task/index',
        icon: 'alarm',
        permission: 'system:task:list',
        sort: 8,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:task:run',
            menuName: '立即执行',
            menuType: MenuType.BUTTON,
            permission: 'system:task:run',
            sort: 1,
          },
        ],
      },
      {
        key: 'system:app-version',
        menuName: 'App 版本',
        menuType: MenuType.MENU,
        path: '/system/app-version',
        component: 'system/app-version/index',
        icon: 'phone',
        permission: 'system:app-version:list',
        sort: 8,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:app-version:add',
            menuName: '上传版本',
            menuType: MenuType.BUTTON,
            permission: 'system:app-version:add',
            sort: 1,
          },
          {
            key: 'system:app-version:edit',
            menuName: '编辑版本',
            menuType: MenuType.BUTTON,
            permission: 'system:app-version:edit',
            sort: 2,
          },
          {
            key: 'system:app-version:remove',
            menuName: '删除版本',
            menuType: MenuType.BUTTON,
            permission: 'system:app-version:remove',
            sort: 3,
          },
        ],
      },
      {
        key: 'system:mail',
        menuName: '邮件设置',
        menuType: MenuType.MENU,
        path: '/system/mail',
        component: 'system/mail/index',
        icon: 'envelope',
        permission: 'system:mail:list',
        sort: 9,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:mail:edit',
            menuName: '编辑邮件设置',
            menuType: MenuType.BUTTON,
            permission: 'system:mail:edit',
            sort: 1,
          },
        ],
      },
      {
        key: 'system:ai',
        menuName: 'AI 设置',
        menuType: MenuType.MENU,
        path: '/system/ai',
        component: 'system/ai/index',
        icon: 'robot',
        permission: 'system:ai:list',
        sort: 10,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:ai:edit',
            menuName: '编辑 AI 设置',
            menuType: MenuType.BUTTON,
            permission: 'system:ai:edit',
            sort: 1,
          },
        ],
      },
      {
        // IP 黑名单：防单 IP 批量注册 / 登录爆破的运维级安全页（对应前端 system/ip-ban/index）。
        // 自动封禁由 IpBanService 依据阈值触发；本菜单提供人工封禁/解封与概览。
        key: 'system:ip-ban',
        menuName: 'IP 黑名单',
        menuType: MenuType.MENU,
        path: '/system/ip-ban',
        component: 'system/ip-ban/index',
        icon: 'shield-x',
        permission: 'ip:ban:list',
        sort: 11,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:ip-ban:add',
            menuName: '封禁 IP',
            menuType: MenuType.BUTTON,
            permission: 'ip:ban:add',
            sort: 1,
          },
          {
            key: 'system:ip-ban:remove',
            menuName: '解封 IP',
            menuType: MenuType.BUTTON,
            permission: 'ip:ban:remove',
            sort: 2,
          },
        ],
      },
      {
        key: 'system:notice',
        menuName: '通知中心',
        menuType: MenuType.MENU,
        path: '/system/notice',
        component: 'system/notice/index',
        icon: 'bell',
        permission: 'system:notice:list',
        sort: 7,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:notice:add',
            menuName: '发布通知',
            menuType: MenuType.BUTTON,
            permission: 'system:notice:add',
            sort: 1,
          },
        ],
      },
      {
        key: 'system:config',
        menuName: '参数管理',
        menuType: MenuType.MENU,
        path: '/system/config',
        component: 'system/config/index',
        icon: 'sliders',
        permission: 'system:config:list',
        sort: 6,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:config:query',
            menuName: '查询参数',
            menuType: MenuType.BUTTON,
            permission: 'system:config:query',
            sort: 1,
          },
          {
            key: 'system:config:add',
            menuName: '新增参数',
            menuType: MenuType.BUTTON,
            permission: 'system:config:add',
            sort: 2,
          },
          {
            key: 'system:config:edit',
            menuName: '编辑参数',
            menuType: MenuType.BUTTON,
            permission: 'system:config:edit',
            sort: 3,
          },
          {
            key: 'system:config:remove',
            menuName: '删除参数',
            menuType: MenuType.BUTTON,
            permission: 'system:config:remove',
            sort: 4,
          },
        ],
      },
    ],
  },
  {
    key: 'monitor',
    menuName: '监控管理',
    menuType: MenuType.DIRECTORY,
    path: '/monitor',
    icon: 'activity',
    sort: 6,
    visible: Status.ENABLED,
    redirect: '/monitor/online',
    children: [
      {
        key: 'monitor:online',
        menuName: '在线用户',
        menuType: MenuType.MENU,
        path: '/monitor/online',
        component: 'monitor/online/index',
        icon: 'people',
        permission: 'monitor:online:list',
        sort: 1,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'monitor:online:forceLogout',
            menuName: '强制下线',
            menuType: MenuType.BUTTON,
            permission: 'monitor:online:forceLogout',
            sort: 1,
          },
        ],
      },
      {
        key: 'monitor:server',
        menuName: '系统监控',
        menuType: MenuType.MENU,
        path: '/monitor/server',
        component: 'monitor/server/index',
        icon: 'cpu',
        permission: 'monitor:server:list',
        sort: 2,
        visible: Status.ENABLED,
        // 不缓存：页面每次进入重新取指标并重建定时器，避免看到已停止刷新的旧曲线
        keepAlive: 0,
      },
    ],
  },
  {
    key: 'log',
    menuName: '日志管理',
    menuType: MenuType.DIRECTORY,
    path: '/log',
    icon: 'file-earmark-text',
    sort: 3,
    visible: Status.ENABLED,
    redirect: '/log/login',
    children: [
      {
        key: 'log:login',
        menuName: '登录日志',
        menuType: MenuType.MENU,
        path: '/log/login',
        component: 'log/login/index',
        icon: 'key',
        permission: 'log:login:list',
        sort: 1,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'log:login:export',
            menuName: '导出登录日志',
            menuType: MenuType.BUTTON,
            permission: 'log:login:export',
            sort: 1,
          },
          {
            key: 'log:login:remove',
            menuName: '删除登录日志',
            menuType: MenuType.BUTTON,
            permission: 'log:login:remove',
            sort: 2,
          },
        ],
      },
      {
        key: 'log:operation',
        menuName: '操作日志',
        menuType: MenuType.MENU,
        path: '/log/operation',
        component: 'log/operation/index',
        icon: 'file-earmark-text',
        permission: 'log:operation:list',
        sort: 2,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'log:operation:export',
            menuName: '导出操作日志',
            menuType: MenuType.BUTTON,
            permission: 'log:operation:export',
            sort: 1,
          },
          {
            key: 'log:operation:remove',
            menuName: '删除操作日志',
            menuType: MenuType.BUTTON,
            permission: 'log:operation:remove',
            sort: 2,
          },
        ],
      },
      {
        key: 'log:http',
        menuName: 'HTTP日志',
        menuType: MenuType.MENU,
        path: '/log/http',
        component: 'log/http/index',
        icon: 'display',
        permission: 'log:http:list',
        sort: 3,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'log:http:export',
            menuName: '导出HTTP日志',
            menuType: MenuType.BUTTON,
            permission: 'log:http:export',
            sort: 1,
          },
          {
            key: 'log:http:clear',
            menuName: '清空HTTP日志',
            menuType: MenuType.BUTTON,
            permission: 'log:http:clear',
            sort: 2,
          },
          {
            key: 'log:http:remove',
            menuName: '删除HTTP日志',
            menuType: MenuType.BUTTON,
            permission: 'log:http:remove',
            sort: 3,
          },
        ],
      },
    ],
  },
  {
    key: 'file',
    menuName: '文件管理',
    menuType: MenuType.MENU,
    path: '/files',
    component: 'files/index',
    icon: 'folder2-open',
    permission: 'file:list',
    sort: 4,
    visible: Status.ENABLED,
    keepAlive: 1,
    children: [
      { key: 'file:upload', menuName: '上传文件', menuType: MenuType.BUTTON, permission: 'file:upload', sort: 1 },
      { key: 'file:remove', menuName: '删除文件', menuType: MenuType.BUTTON, permission: 'file:remove', sort: 2 },
      { key: 'file:download', menuName: '下载文件', menuType: MenuType.BUTTON, permission: 'file:download', sort: 3 },
    ],
  },
  {
    key: 'tool',
    menuName: '系统工具',
    menuType: MenuType.DIRECTORY,
    path: '/tool',
    icon: 'tools',
    sort: 5,
    visible: Status.ENABLED,
    redirect: '/tool/gen',
    children: [
      {
        key: 'tool:gen',
        menuName: '代码生成',
        menuType: MenuType.MENU,
        path: '/tool/gen',
        component: 'tool/gen/index',
        icon: 'code-slash',
        permission: 'tool:gen:list',
        sort: 1,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'tool:gen:preview',
            menuName: '预览代码',
            menuType: MenuType.BUTTON,
            permission: 'tool:gen:preview',
            sort: 1,
          },
          {
            key: 'tool:gen:download',
            menuName: '下载代码',
            menuType: MenuType.BUTTON,
            permission: 'tool:gen:download',
            sort: 2,
          },
          {
            key: 'tool:gen:create',
            menuName: '生成到项目',
            menuType: MenuType.BUTTON,
            permission: 'tool:gen:create',
            sort: 3,
          },
        ],
      },
    ],
  },
  {
    key: 'docs',
    menuName: '接口文档',
    menuType: MenuType.MENU,
    path: '/docs',
    component: 'docs/index',
    icon: 'journal-text',
    sort: 6,
    visible: Status.ENABLED,
    keepAlive: 1,
  },
  {
    key: 'profile',
    menuName: '个人中心',
    menuType: MenuType.MENU,
    path: '/profile',
    component: 'profile/index',
    icon: 'person-circle',
    sort: 5,
    visible: Status.DISABLED,
    keepAlive: 1,
  },
  {
    key: 'sentence',
    menuName: '短句管理',
    menuType: MenuType.DIRECTORY,
    path: '/sentence',
    icon: 'chat-quote',
    sort: 7,
    visible: Status.ENABLED,
    redirect: '/sentence/list',
    children: [
      {
        key: 'sentence:list',
        menuName: '题库管理',
        menuType: MenuType.MENU,
        path: '/sentence/list',
        component: 'sentence/index',
        icon: 'card-text',
        permission: 'sentence:list',
        sort: 1,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'sentence:query',
            menuName: '查询题目',
            menuType: MenuType.BUTTON,
            permission: 'sentence:query',
            sort: 1,
          },
          {
            key: 'sentence:add',
            menuName: '新增题目',
            menuType: MenuType.BUTTON,
            permission: 'sentence:add',
            sort: 2,
          },
          {
            key: 'sentence:edit',
            menuName: '编辑题目',
            menuType: MenuType.BUTTON,
            permission: 'sentence:edit',
            sort: 3,
          },
          {
            key: 'sentence:remove',
            menuName: '下架题目',
            menuType: MenuType.BUTTON,
            permission: 'sentence:remove',
            sort: 4,
          },
          {
            key: 'sentence:gen',
            menuName: '生成题库',
            menuType: MenuType.BUTTON,
            permission: 'sentence:gen',
            sort: 5,
          },
        ],
      },
      {
        key: 'sentence:category',
        menuName: '场景分类',
        menuType: MenuType.MENU,
        path: '/sentence/category',
        component: 'sentence/category',
        icon: 'tags',
        permission: 'sentence:list',
        sort: 2,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'sentence:category:edit',
            menuName: '维护分类',
            menuType: MenuType.BUTTON,
            permission: 'sentence:category',
            sort: 1,
          },
        ],
      },
      {
        key: 'sentence:clients',
        menuName: '客户端用户',
        menuType: MenuType.MENU,
        path: '/sentence/clients',
        component: 'sentence/clients',
        icon: 'people',
        permission: 'client:user:list',
        sort: 3,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'client:user:query',
            menuName: '查看详情',
            menuType: MenuType.BUTTON,
            permission: 'client:user:query',
            sort: 1,
          },
          {
            key: 'client:user:edit',
            menuName: '启用/禁用',
            menuType: MenuType.BUTTON,
            permission: 'client:user:edit',
            sort: 2,
          },
          {
            key: 'client:user:reset',
            menuName: '重置密码',
            menuType: MenuType.BUTTON,
            permission: 'client:user:reset',
            sort: 3,
          },
          {
            key: 'client:user:offline',
            menuName: '强制下线',
            menuType: MenuType.BUTTON,
            permission: 'client:user:offline',
            sort: 4,
          },
          {
            key: 'client:user:delete',
            menuName: '删除用户',
            menuType: MenuType.BUTTON,
            permission: 'client:user:delete',
            sort: 5,
          },
        ],
      },
      {
        key: 'sentence:analytics',
        menuName: '数据分析',
        menuType: MenuType.MENU,
        path: '/sentence/analytics',
        component: 'sentence/analytics',
        icon: 'bar-chart',
        permission: 'analytics:view',
        sort: 4,
        visible: Status.ENABLED,
        keepAlive: 1,
      },
      {
        key: 'sentence:ai-logs',
        menuName: 'AI 调用日志',
        menuType: MenuType.MENU,
        path: '/sentence/ai-logs',
        component: 'sentence/ai-logs',
        icon: 'robot',
        permission: 'analytics:view',
        sort: 5,
        visible: Status.ENABLED,
        keepAlive: 1,
      },
      {
        key: 'sentence:report',
        menuName: '举报处理',
        menuType: MenuType.MENU,
        path: '/sentence/report',
        component: 'sentence/report',
        icon: 'flag',
        permission: 'sentence:report',
        sort: 6,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'sentence:report:handle',
            menuName: '处理举报',
            menuType: MenuType.BUTTON,
            permission: 'sentence:report:handle',
            sort: 1,
          },
        ],
      },
      {
        key: 'sentence:card',
        menuName: '每日句签',
        menuType: MenuType.MENU,
        path: '/sentence/card',
        component: 'sentence/card',
        icon: 'calendar-heart',
        permission: 'sentence:card:list',
        sort: 7,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'sentence:card:edit',
            menuName: '编辑文案',
            menuType: MenuType.BUTTON,
            permission: 'sentence:card:edit',
            sort: 1,
          },
          {
            key: 'sentence:card:gen',
            menuName: '重新生成',
            menuType: MenuType.BUTTON,
            permission: 'sentence:card:gen',
            sort: 2,
          },
          {
            key: 'sentence:card:remove',
            menuName: '删除',
            menuType: MenuType.BUTTON,
            permission: 'sentence:card:remove',
            sort: 3,
          },
        ],
      },
      {
        key: 'sentence:wordroot',
        menuName: '词根词典',
        menuType: MenuType.MENU,
        path: '/sentence/word-root',
        component: 'sentence/word-root',
        icon: 'book',
        permission: 'sentence:wordroot:list',
        sort: 8,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'sentence:wordroot:edit',
            menuName: '编辑词条',
            menuType: MenuType.BUTTON,
            permission: 'sentence:wordroot:edit',
            sort: 1,
          },
          {
            key: 'sentence:wordroot:gen',
            menuName: '立即解析',
            menuType: MenuType.BUTTON,
            permission: 'sentence:wordroot:gen',
            sort: 2,
          },
          {
            key: 'sentence:wordroot:remove',
            menuName: '删除词条',
            menuType: MenuType.BUTTON,
            permission: 'sentence:wordroot:remove',
            sort: 3,
          },
        ],
      },
      {
        // 客户端公告：发到用户端（Web / App）的全员通知，与后台站内信（通知中心）是两回事
        key: 'client:notice',
        menuName: '客户端通知',
        menuType: MenuType.MENU,
        path: '/sentence/client-notice',
        component: 'sentence/client-notice',
        icon: 'megaphone',
        permission: 'client:notice:list',
        sort: 9,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'client:notice:add',
            menuName: '发布公告',
            menuType: MenuType.BUTTON,
            permission: 'client:notice:add',
            sort: 1,
          },
          {
            key: 'client:notice:edit',
            menuName: '编辑/撤回',
            menuType: MenuType.BUTTON,
            permission: 'client:notice:edit',
            sort: 2,
          },
          {
            key: 'client:notice:remove',
            menuName: '删除公告',
            menuType: MenuType.BUTTON,
            permission: 'client:notice:remove',
            sort: 3,
          },
        ],
      },
      {
        // 客户端反馈：用户对**产品本身**的意见（与「题目举报」是两回事，后者在题库管理里）
        key: 'client:feedback',
        menuName: '客户端反馈',
        menuType: MenuType.MENU,
        path: '/sentence/feedback',
        component: 'sentence/feedback',
        icon: 'chat-dots',
        permission: 'client:feedback:list',
        sort: 10,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'client:feedback:handle',
            menuName: '处理反馈',
            menuType: MenuType.BUTTON,
            permission: 'client:feedback:handle',
            sort: 1,
          },
        ],
      },
      {
        // 接龙审核：UGC 内容复核（举报达阈值自动隐藏，这里可人工恢复/删除）
        key: 'sentence:chain',
        menuName: '接龙审核',
        menuType: MenuType.MENU,
        path: '/sentence/chain',
        component: 'sentence/chain',
        icon: 'chat-square-quote',
        permission: 'sentence:chain',
        sort: 11,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'sentence:chain:handle',
            menuName: '审核/删除',
            menuType: MenuType.BUTTON,
            permission: 'sentence:chain:handle',
            sort: 1,
          },
        ],
      },
      {
        // 情景闯关：关卡总览 + 对话会话抽查（AI 质量/客诉），可强制结束异常会话
        key: 'sentence:stage',
        menuName: '情景闯关',
        menuType: MenuType.MENU,
        path: '/sentence/stage',
        component: 'sentence/stage',
        icon: 'map',
        permission: 'stage:view',
        sort: 12,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'stage:handle',
            menuName: '强制结束会话',
            menuType: MenuType.BUTTON,
            permission: 'stage:handle',
            sort: 1,
          },
        ],
      },
      {
        // 学习小队：小队列表/详情/解散/改名（运营干预不当队名与违规队伍）
        key: 'sentence:team',
        menuName: '学习小队',
        menuType: MenuType.MENU,
        path: '/sentence/team',
        component: 'sentence/team',
        icon: 'people',
        permission: 'team:view',
        sort: 13,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'team:handle',
            menuName: '解散/改名',
            menuType: MenuType.BUTTON,
            permission: 'team:handle',
            sort: 1,
          },
        ],
      },
    ],
  },
  // [GEN-ANCHOR] 代码生成器自动插入位置，请勿删除（gen.writer 会在本行之前插入新模块菜单节点）
];

/**
 * 写入菜单树（幂等：按 名称 + 父级 + 类型 去重，已存在则复用其 id）。
 * @param prisma Prisma 客户端
 * @returns key → 菜单 id 映射
 */
async function seedMenu(prisma: PrismaService): Promise<Map<string, number>> {
  const keyToId = new Map<string, number>();

  const walk = async (nodes: MenuSeedNode[], parentId: number): Promise<void> => {
    for (const node of nodes) {
      const existing = await prisma.menu.findFirst({
        where: { menuName: node.menuName, parentId: BigInt(parentId), menuType: node.menuType },
      });
      const menu =
        existing ??
        (await prisma.menu.create({
          data: {
            parentId: BigInt(parentId),
            menuName: node.menuName,
            menuType: node.menuType,
            path: node.path ?? null,
            component: node.component ?? null,
            icon: node.icon ?? null,
            permission: node.permission ?? null,
            sort: node.sort,
            visible: node.visible ?? Status.ENABLED,
            status: node.status ?? Status.ENABLED,
            redirect: node.redirect ?? null,
            keepAlive: node.keepAlive ?? 0,
          },
        }));

      const menuId = Number(menu.id);
      keyToId.set(node.key, menuId);
      if (node.children && node.children.length > 0) {
        await walk(node.children, menuId);
      }
    }
  };

  await walk(MENU_TREE, 0);
  return keyToId;
}

/* --------------------------------- 角色种子 -------------------------------- */

/** 角色种子定义。 */
interface RoleSeed {
  roleCode: string;
  roleName: string;
  sort: number;
  status: number;
  remark: string;
  /** 授权菜单 key 列表，'ALL' 表示全部菜单 */
  menuKeys: string[] | 'ALL';
}

/** 默认角色定义。 */
const ROLE_SEEDS: RoleSeed[] = [
  {
    roleCode: SUPER_ADMIN_ROLE,
    roleName: '超级管理员',
    sort: 1,
    status: Status.ENABLED,
    remark: '系统最高权限，拥有全部菜单与按钮权限',
    menuKeys: 'ALL',
  },
  {
    roleCode: 'admin',
    roleName: '普通管理员',
    sort: 2,
    status: Status.ENABLED,
    remark: '业务运营管理者，可管理用户与查看日志',
    menuKeys: [
      'dashboard',
      'system',
      'system:user',
      'system:user:query',
      'system:user:add',
      'system:user:edit',
      'system:user:remove',
      'system:user:resetPwd',
      'system:user:assignRole',
      // 用户额外权限（在角色之上给单个用户加/减权限）
      'system:user:assignPerm',
      // 角色下拉（GET /api/roles/all 所需）；admin 无 system:role:list，靠此独立码拉下拉框
      'system:role:all',
      // 字典管理：admin 可维护字典（含启停用，复用 system:dict:edit）
      'system:dict',
      'system:dict:add',
      'system:dict:edit',
      'system:dict:remove',
      // 部门管理：admin 可维护部门树
      'system:dept',
      'system:dept:query',
      'system:dept:add',
      'system:dept:edit',
      'system:dept:remove',
      // 参数管理：admin 可维护系统参数
      'system:config',
      'system:config:query',
      'system:config:add',
      'system:config:edit',
      'system:config:remove',
      // 定时任务：admin 仅可**查看**任务列表与执行记录（只读观察调度状况）。
      // 手动执行（system:task:run）属系统级动作，仅超管持有——与 log:http:clear 同级。
      'system:task',
      'log',
      'log:login',
      'log:login:export',
      'log:operation',
      'log:operation:export',
      'log:http',
      // HTTP 日志导出属只读查看能力，与登录/操作日志导出保持一致授予 admin
      'log:http:export',
      // 说明：admin 为「业务运营管理者」，不应持有系统级能力。以下两个权限码已回收，
      // 仅由超管（menuKeys: 'ALL'）持有：
      //   - log:http:clear —— 清空全量日志，属破坏性系统操作；
      //   - tool:gen:create —— 向源码目录写 .ts/.vue，属系统级代码生成能力。
      // 前端按钮已配置 v-permission，回收后 admin 侧将自动隐藏，无需改动前端。
      'file',
      'file:upload',
      'file:remove',
      'file:download',
      'tool',
      'tool:gen',
      'tool:gen:preview',
      'tool:gen:download',
      // 接口文档（纯只读的查看类菜单，无按钮权限码）
      'docs',
      'profile',
      // IP 黑名单：运维级安全动作，admin 可查看列表/统计并人工封禁/解封（与 system:task:run 同级）。
      // 超管（menuKeys: 'ALL'）自动覆盖，无需在此列出。
      'system:ip-ban',
      'system:ip-ban:add',
      'system:ip-ban:remove',
    ],
  },
  {
    roleCode: 'viewer',
    roleName: '只读访客',
    sort: 3,
    status: Status.ENABLED,
    // 严格只读：只授予查看/查询类权限码，任何写操作与破坏性操作（如 log:http:clear、
    // system:role:all 枚举全部角色）一律不得加入此列表，否则只读角色将获得越权能力。
    remark: '仅拥有查看类权限',
    menuKeys: [
      'dashboard',
      'system',
      'system:user',
      'system:user:query',
      // 字典管理：只读角色仅授予菜单节点（即只读的 system:dict:list），不含任何写权限码
      'system:dict',
      // 部门管理：只读角色仅授予菜单节点（即只读的 system:dept:list），不含任何写权限码
      'system:dept',
      // 参数管理：只读角色仅授予菜单节点（即只读的 system:config:list），不含任何写权限码
      'system:config',
      // 定时任务：只读角色仅授予菜单节点（即只读的 system:task:list），不含手动执行（system:task:run）
      'system:task',
      'log',
      'log:login',
      'log:operation',
      'log:http',
      // 接口文档（纯只读的查看类菜单，无写操作）
      'docs',
      'profile',
    ],
  },
];

/** 种子角色编码集合（供「恢复默认授权」判断目标是否是种子角色）。 */
export const SEED_ROLE_CODES: string[] = ROLE_SEEDS.map((seed) => seed.roleCode);

/**
 * 写入默认角色。
 *
 * ⚠️ **只在角色不存在时创建并写授权；已存在的角色完全不碰它的菜单授权。**
 * 曾经的实现是「每次启动都 deleteMany + 按种子重建」，等于把运维在角色管理里调好的授权
 * 在重启 / 部署时**静默回滚**——调过权限的人不会收到任何提示，属于数据丢失级问题。
 * 现在种子只负责「首次创建」；需要按种子重置时走管理端的「恢复默认授权」
 * （{@link resetSeedRoleMenus}：显式触发、有权限码、有操作日志）。
 *
 * @param prisma Prisma 客户端
 * @param menuIdMap 菜单 key → id 映射（由菜单种子产出）
 * @returns 新建 / 跳过的角色数
 */
export async function seedRole(
  prisma: PrismaService,
  menuIdMap: Map<string, number>,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const seed of ROLE_SEEDS) {
    const existing = await prisma.role.findUnique({ where: { roleCode: seed.roleCode }, select: { id: true } });
    if (existing) {
      // 角色已存在（其授权可能已被运维调整过）→ 保持原样，绝不覆盖
      skipped += 1;
      continue;
    }
    const role = await prisma.role.create({
      data: {
        roleName: seed.roleName,
        roleCode: seed.roleCode,
        sort: seed.sort,
        status: seed.status,
        // 存量角色保持「全部数据」，需要收紧时在角色管理中按需调整
        dataScope: DataScope.ALL,
        remark: seed.remark,
      },
    });
    await applySeedMenus(prisma, role.id, seed, menuIdMap);
    created += 1;
  }

  return { created, skipped };
}

/**
 * 按种子定义为角色写菜单授权（先清后建）。
 * @param prisma Prisma 客户端
 * @param roleId 角色 id
 * @param seed 角色种子定义
 * @param menuIdMap 菜单 key → id 映射
 * @returns 写入的授权条数
 */
async function applySeedMenus(
  prisma: PrismaService,
  roleId: bigint,
  seed: RoleSeed,
  menuIdMap: Map<string, number>,
): Promise<number> {
  const allMenuIds = Array.from(menuIdMap.values());
  const menuIds =
    seed.menuKeys === 'ALL'
      ? allMenuIds
      : seed.menuKeys.map((key) => menuIdMap.get(key)).filter((id): id is number => typeof id === 'number');

  // 先清后建：调用方必须是「新建角色」或「运维显式要求重置」两种已确认场景
  await prisma.roleMenu.deleteMany({ where: { roleId } });
  if (menuIds.length > 0) {
    await prisma.roleMenu.createMany({
      data: menuIds.map((menuId) => ({ roleId, menuId: BigInt(menuId) })),
      skipDuplicates: true,
    });
  }
  return menuIds.length;
}

/**
 * 按种子定义**重建**角色的菜单授权（管理端「恢复默认授权」用）。
 *
 * 与启动种子 {@link seedRole} 的关键区别：这里是运维**主动触发**的显式覆盖（先清后建），
 * 而启动种子只负责首次创建、绝不覆盖已有授权。
 *
 * @param prisma Prisma 客户端
 * @param roleCode 指定角色编码；省略则处理全部种子角色
 * @returns 每个被重建角色的授权条数；角色不存在则跳过（不顺手创建）
 */
export async function resetSeedRoleMenus(
  prisma: PrismaService,
  roleCode?: string,
): Promise<Array<{ id: number; roleCode: string; roleName: string; count: number }>> {
  // 幂等补建缺失的菜单节点，保证种子 key 都能解析到 id
  const menuIdMap = await seedMenu(prisma);
  const seeds = roleCode ? ROLE_SEEDS.filter((seed) => seed.roleCode === roleCode) : ROLE_SEEDS;

  const result: Array<{ id: number; roleCode: string; roleName: string; count: number }> = [];
  for (const seed of seeds) {
    const role = await prisma.role.findUnique({
      where: { roleCode: seed.roleCode },
      select: { id: true, roleName: true },
    });
    if (!role) {
      continue;
    }
    const count = await applySeedMenus(prisma, role.id, seed, menuIdMap);
    result.push({ id: Number(role.id), roleCode: seed.roleCode, roleName: role.roleName, count });
  }
  return result;
}

/* --------------------------------- 用户种子 -------------------------------- */

/** 种子超管口令的默认值（仅本地开发便利，生产部署必须用 `SEED_ADMIN_PASSWORD` 覆盖）。 */
const DEFAULT_SEED_ADMIN_PASSWORD = '123456';

/**
 * 实际生效的种子超管口令。
 *
 * 单独抽成导出函数是为了让 e2e 测试**复用同一套取值逻辑**：曾经测试里硬编码 `123456`，
 * 而 CI 通过环境变量注入 `SEED_ADMIN_PASSWORD`，两边一不一致就 401（真实发生过）。
 */
export function resolveSeedAdminPassword(): string {
  return process.env.SEED_ADMIN_PASSWORD?.trim() || DEFAULT_SEED_ADMIN_PASSWORD;
}

/**
 * 写入超级管理员 `admin` 并绑定超管角色（幂等：已存在的账号不覆盖密码）。
 *
 * 口令来自 `SEED_ADMIN_PASSWORD`；未配置时回退默认值，并在生产环境打 warn —— 默认口令
 * 是弱口令（且不满足口令策略的长度要求，仅因为种子直写哈希才绕过了校验）。
 */
async function seedUser(prisma: PrismaService): Promise<void> {
  const superRole = await prisma.role.findUnique({ where: { roleCode: SUPER_ADMIN_ROLE } });
  const configuredPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  const password = configuredPassword || DEFAULT_SEED_ADMIN_PASSWORD;
  if (!configuredPassword && process.env.NODE_ENV === 'production') {
    logger.warn('[Seed] 未配置 SEED_ADMIN_PASSWORD，超管账号使用默认弱口令；请设置后重新执行种子或立即改密');
  }

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: await hashPassword(password),
      nickname: '超级管理员',
      status: Status.ENABLED,
      remark: '内置超级管理员账号',
    },
  });

  if (superRole) {
    const userId = admin.id;
    const roleId = superRole.id;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }
}

/* --------------------------------- 字典种子 -------------------------------- */

/** 字典项种子定义。 */
interface DictItemSeed {
  dictLabel: string;
  dictValue: string;
  sort: number;
  remark?: string;
}

/** 字典类型种子定义。 */
interface DictTypeSeed {
  dictName: string;
  dictType: string;
  remark: string;
  items: DictItemSeed[];
}

/** 默认字典定义。 */
const DICT_SEEDS: DictTypeSeed[] = [
  {
    dictName: '用户性别',
    dictType: 'sys_user_sex',
    remark: '用户性别列表',
    items: [
      { dictLabel: '男', dictValue: '1', sort: 1 },
      { dictLabel: '女', dictValue: '2', sort: 2 },
      { dictLabel: '未知', dictValue: '0', sort: 3 },
    ],
  },
  {
    dictName: '系统是否',
    dictType: 'sys_yes_no',
    remark: '通用是否（Y / N）',
    items: [
      { dictLabel: '是', dictValue: 'Y', sort: 1 },
      { dictLabel: '否', dictValue: 'N', sort: 2 },
    ],
  },
  {
    dictName: '通用状态',
    dictType: 'sys_common_status',
    remark: '启用 / 禁用',
    items: [
      { dictLabel: '启用', dictValue: '1', sort: 1 },
      { dictLabel: '禁用', dictValue: '0', sort: 2 },
    ],
  },
];

/**
 * 写入常用字典类型与字典项（幂等：类型按 dictType、项按「类型 + 值」去重，已存在则跳过，
 * 不覆盖使用者在界面上后续做的修改）。
 */
async function seedDict(prisma: PrismaService): Promise<void> {
  let typeCreated = 0;
  let itemCreated = 0;

  for (const seed of DICT_SEEDS) {
    const exists = await prisma.dictType.findUnique({ where: { dictType: seed.dictType } });
    if (!exists) {
      await prisma.dictType.create({
        data: {
          dictName: seed.dictName,
          dictType: seed.dictType,
          status: Status.ENABLED,
          remark: seed.remark,
        },
      });
      typeCreated += 1;
    }

    for (const item of seed.items) {
      // dict_item 上只有 dictType 普通索引、无唯一约束，故用 findFirst + create 表达 findOrCreate
      const itemExists = await prisma.dictItem.findFirst({
        where: { dictType: seed.dictType, dictValue: item.dictValue },
      });
      if (!itemExists) {
        await prisma.dictItem.create({
          data: {
            dictType: seed.dictType,
            dictLabel: item.dictLabel,
            dictValue: item.dictValue,
            sort: item.sort,
            status: Status.ENABLED,
            remark: item.remark ?? null,
          },
        });
        itemCreated += 1;
      }
    }
  }

  logger.log(`字典数据完成，新增 ${typeCreated} 个字典类型 / ${itemCreated} 个字典项`);
}

/* ------------------------------- 系统参数种子 ------------------------------- */

/** 内置参数定义。 */
interface ConfigSeed {
  configName: string;
  configKey: string;
  configValue: string;
  remark: string;
}

/** 内置参数（登录安全等模块的运行时可调项）。 */
const CONFIG_SEEDS: ConfigSeed[] = [
  {
    configName: '登录失败锁定阈值',
    configKey: 'sys.account.maxLoginAttempts',
    configValue: '5',
    remark: '同一账号连续登录失败达到该次数后触发锁定（登录安全加固模块读取）',
  },
  {
    configName: '账号锁定时长（分钟）',
    configKey: 'sys.account.lockMinutes',
    configValue: '15',
    remark: '登录锁定持续时间，超过后自动解除锁定',
  },
  {
    configName: '每日提醒发送小时',
    configKey: 'sys.mail.reminderHour',
    configValue: '18',
    remark: '每日学习提醒邮件的发送小时（0-23，默认 18 点）；保存后自动重排定时任务，无需重启',
  },
  {
    configName: '每日提醒发送分钟',
    configKey: 'sys.mail.reminderMinute',
    configValue: '0',
    remark: '每日学习提醒邮件的发送分钟（0-59，默认 0 分）',
  },
  {
    configName: '每日提醒开关',
    configKey: 'sys.mail.reminderEnabled',
    configValue: '1',
    remark: '每日学习提醒邮件总开关（1 开启 / 0 停用）；停用后不注册调度',
  },
];

/** 写入内置系统参数（幂等：按 configKey 去重，已存在的键不覆盖现值，便于运维自行调参）。 */
async function seedConfig(prisma: PrismaService): Promise<void> {
  for (const seed of CONFIG_SEEDS) {
    await prisma.sysConfig.upsert({
      where: { configKey: seed.configKey },
      update: {},
      create: {
        configName: seed.configName,
        configKey: seed.configKey,
        configValue: seed.configValue,
        systemFlag: 1,
        remark: seed.remark,
      },
    });
  }
  logger.log(`系统参数数据完成，共 ${CONFIG_SEEDS.length} 项`);
}

/* ------------------------------ 既有库数据归一 ------------------------------ */

/**
 * 清理废弃的系统参数。
 * 背景：`sys.company.name` 已不再属于种子定义（公司信息由「顶级部门」承载）。种子只增不删，
 * 既有库中残留的行不会自动消失，会导致参数管理页面仍列出「公司名称」。此处按 configKey
 * 幂等删除，任何环境重启即收敛，且不影响其他参数。
 *
 * 旧版 AI 配置键（`ai.agnes.*`）**只在 ai.models 已存在时**才清理：迁移必须先读到旧键才能
 * 保住密钥/模型名，seed 若抢先删除，AiSettingsService 只能回落到环境变量（丢 key）。
 * 因此这里加前置条件，正常迁移仍由 AiSettingsService 完成并删键。
 */
async function cleanupObsoleteConfigs(prisma: PrismaService): Promise<void> {
  const OBSOLETE_CONFIG_KEYS = ['sys.company.name'];
  const { count } = await prisma.sysConfig.deleteMany({ where: { configKey: { in: OBSOLETE_CONFIG_KEYS } } });
  if (count > 0) {
    logger.log(`已清理废弃系统参数 ${count} 项：${OBSOLETE_CONFIG_KEYS.join(', ')}`);
  }

  // 旧 AI 键：迁移完成（ai.models 已存在）后才允许清理，避免抢在迁移前删掉密钥
  const migrated = await prisma.sysConfig.findUnique({ where: { configKey: AI_CONFIG_KEYS.models } });
  if (!migrated) {
    return;
  }
  const legacyKeys = Object.values(LEGACY_AI_CONFIG_KEYS);
  const legacy = await prisma.sysConfig.deleteMany({ where: { configKey: { in: legacyKeys } } });
  if (legacy.count > 0) {
    logger.log(`已清理旧版 AI 参数 ${legacy.count} 项（ai.models 已就绪）`);
  }
}

/**
 * 清理废弃的菜单节点（及其角色 / 用户级关联）。
 *
 * 背景：Vditor 编辑器示例页已整体移除（前端组件、静态资源、依赖均已删除），
 * 对应的菜单节点不再属于种子定义。种子只增不删，既有库中残留的菜单不会自动消失，
 * 会导致后台左侧菜单仍显示「Vditor 编辑器」，点击后路由找不到对应组件而白屏。
 *
 * 这里按 `permission` 精确匹配删除（`tool:vditor:list`），并先清理
 * `sys_role_menu` / `sys_user_menu` 关联——两张表对 menu 都有外键，
 * 直接删菜单会触发约束错误。
 *
 * 幂等：库中没有该节点时不做任何事，重复执行安全。
 */
async function cleanupObsoleteMenus(prisma: PrismaService): Promise<void> {
  const OBSOLETE_MENU_PERMISSIONS = ['tool:vditor:list'];

  const obsolete = await prisma.menu.findMany({
    where: { permission: { in: OBSOLETE_MENU_PERMISSIONS } },
    select: { id: true, menuName: true },
  });
  if (obsolete.length === 0) {
    return;
  }

  const menuIds = obsolete.map((item) => item.id);
  // 先删关联再删菜单：sys_role_menu / sys_user_menu 对 menu 有外键约束
  await prisma.roleMenu.deleteMany({ where: { menuId: { in: menuIds } } });
  await prisma.userMenu.deleteMany({ where: { menuId: { in: menuIds } } });
  await prisma.menu.deleteMany({ where: { id: { in: menuIds } } });

  logger.log(
    `已清理废弃菜单 ${obsolete.length} 项：${obsolete.map((item) => item.menuName).join('、')}` +
      `（关联的角色 / 用户授权同步移除）`,
  );
}

/**
 * 组件名无法直接推导的图标别名。
 *
 * 原生类名的数字连字符规则**不一致**：`diagram-3` 对应 `BIconDiagram3`（数字前有连字符），
 * 而 `speedometer2` 对应 `BIconSpeedometer2`（数字前无连字符）。两者组件名形式完全相同，
 * 却指向不同的原生类名，无法用统一规则还原，只能显式列出（仅 diagram 系列命中该歧义）。
 */
const ICON_ALIASES: Record<string, string> = {
  BIconDiagram2: 'diagram-2',
  BIconDiagram3: 'diagram-3',
};

/** 组件名（`BIconBarChartLine`）→ 原生图标名（`bar-chart-line`）。 */
function toNativeIconName(name: string): string {
  const alias = ICON_ALIASES[name];
  if (alias) {
    return alias;
  }
  return name
    .replace(/^BIcon/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * 归一化 `sys_menu.icon`：把组件名形式（`BIconDiagram3`）转成 Bootstrap Icons 原生类名（`diagram-3`）。
 *
 * 约定：`sys_menu.icon` 统一存储原生类名，前端以 `<i class="bi bi-diagram-3" />` 渲染。
 * 存量行若为组件名形式则无法渲染，故在启动时做一次幂等转换；归一化完成后不再有匹配行，
 * 后续启动为空操作。
 */
async function normalizeMenuIcons(prisma: PrismaService): Promise<void> {
  const rows = await prisma.menu.findMany({
    where: { icon: { startsWith: 'BIcon' } },
    select: { id: true, icon: true },
  });
  if (rows.length === 0) {
    return;
  }

  for (const row of rows) {
    const name = String(row.icon);
    const native = toNativeIconName(name);
    await prisma.menu.update({ where: { id: row.id }, data: { icon: native } });
    logger.log(`菜单图标已归一化：${name} -> ${native}`);
  }
  logger.log(`已归一化 ${rows.length} 个菜单图标为 Bootstrap Icons 原生类名`);
}

/* ---------------------------------- 入口 ---------------------------------- */

/**
 * 执行全部种子（幂等）。
 * 顺序：先做既有库数据归一（清理废弃参数、清理废弃菜单、归一化图标名），
 * 再按 菜单 → 角色 → 用户 → 字典 → 系统参数 写入种子数据。
 */
export async function runSeed(prisma: PrismaService): Promise<void> {
  await cleanupObsoleteConfigs(prisma);
  await cleanupObsoleteMenus(prisma);
  await normalizeMenuIcons(prisma);

  const menuIdMap = await seedMenu(prisma);
  logger.log(`菜单数据完成，共 ${menuIdMap.size} 个节点`);

  const roleStat = await seedRole(prisma, menuIdMap);
  logger.log(
    `角色数据完成，共 ${ROLE_SEEDS.length} 个：新建 ${roleStat.created} 个，已存在 ${roleStat.skipped} 个` +
      `（已有角色的菜单授权不被覆盖，需重置请用「恢复默认授权」）`,
  );

  await seedUser(prisma);
  logger.log('用户数据完成，超管账号 admin（口令见 SEED_ADMIN_PASSWORD，未配置时为开发默认口令）');

  await seedDict(prisma);
  await seedConfig(prisma);
  await seedSentenceCategories(prisma);
  await seedAchievements(prisma);
  await seedChainTopics(prisma);
  await seedIpaPhonemes(prisma);

  logger.log('种子数据初始化完成');
}

/* --------------------------------- 短句分类种子 -------------------------------- */

/**
 * 默认场景分类（幂等；名称为唯一业务键）。
 *
 * 分类名会直接拼进生题提示词（见 SentenceGenService.currentTheme），
 * 所以**每加一个分类就等于给模型多开一片题材**——早期只有 6 个，
 * 生成出来的句子翻来覆去都是「咖啡店/办公室/机场」那几类场景。
 * 现扩到 14 个，覆盖日常高频交际场景。
 *
 * 图标写 **lucide 名**（客户端拼 `i-lucide-*`，App 端查 lib/theme/icon_map.dart），
 * 新增前务必确认名字在 lucide 里真实存在，否则 Web 端会画不出图标。
 * 注意：本函数按 name 幂等，**只补新分类、不更新已有行**——改老分类的图标要在后台改。
 */
const SENTENCE_CATEGORY_SEEDS: Array<{ name: string; nameEn: string; icon: string; sort: number }> = [
  { name: '日常生活', nameEn: 'Daily Life', icon: 'house', sort: 1 },
  { name: '职场办公', nameEn: 'Workplace', icon: 'briefcase', sort: 2 },
  { name: '旅行出行', nameEn: 'Travel', icon: 'airplane', sort: 3 },
  { name: '餐饮美食', nameEn: 'Dining', icon: 'cup-hot', sort: 4 },
  { name: '社交闲聊', nameEn: 'Social', icon: 'people', sort: 5 },
  { name: '学习成长', nameEn: 'Learning', icon: 'book', sort: 6 },
  { name: '购物消费', nameEn: 'Shopping', icon: 'shopping-bag', sort: 7 },
  { name: '健康医疗', nameEn: 'Health', icon: 'stethoscope', sort: 8 },
  { name: '运动健身', nameEn: 'Sports & Fitness', icon: 'dumbbell', sort: 9 },
  { name: '情感沟通', nameEn: 'Emotions', icon: 'heart', sort: 10 },
  { name: '科技数码', nameEn: 'Technology', icon: 'laptop', sort: 11 },
  { name: '居家生活', nameEn: 'Home & Living', icon: 'sofa', sort: 12 },
  { name: '娱乐休闲', nameEn: 'Entertainment', icon: 'clapperboard', sort: 13 },
  { name: '天气与季节', nameEn: 'Weather & Seasons', icon: 'cloud-sun', sort: 14 },
];

/** 写入场景分类（幂等：按 name 去重）。 */
async function seedSentenceCategories(prisma: PrismaService): Promise<void> {
  let created = 0;
  for (const seed of SENTENCE_CATEGORY_SEEDS) {
    const existing = await prisma.sentenceCategory.findFirst({ where: { name: seed.name }, select: { id: true } });
    if (!existing) {
      await prisma.sentenceCategory.create({
        data: {
          name: seed.name,
          nameEn: seed.nameEn,
          icon: seed.icon,
          sort: seed.sort,
          status: Status.ENABLED,
        },
      });
      created += 1;
    }
  }
  logger.log(`短句分类数据完成，共 ${SENTENCE_CATEGORY_SEEDS.length} 个（新建 ${created} 个）`);
}

/* --------------------------------- 接龙主题种子 -------------------------------- */

/**
 * 写入接龙主题（幂等：按 title 去重）。
 *
 * **只补不更新**：运营在后台改过的提示语不该被下一次启动覆盖，
 * 与成就种子同口径（那边按 code 只补，这边按 title 只补）。
 */
async function seedChainTopics(prisma: PrismaService): Promise<void> {
  let created = 0;
  for (const seed of CHAIN_TOPIC_SEEDS) {
    const existing = await prisma.chainTopic.findFirst({ where: { title: seed.title }, select: { id: true } });
    if (!existing) {
      await prisma.chainTopic.create({
        data: {
          title: seed.title,
          starterEn: seed.starterEn,
          promptZh: seed.promptZh,
          sort: seed.sort,
          status: Status.ENABLED,
        },
      });
      created += 1;
    }
  }
  logger.log(`接龙主题数据完成，共 ${CHAIN_TOPIC_SEEDS.length} 个（新建 ${created} 个）`);
}

/* -------------------------------- 音标种子 -------------------------------- */

/**
 * 音标库种子（48 个国际音标）。
 * 口径与接龙主题同款：按 symbol 只补不覆盖——修订发音要点时不要新增重复 symbol。
 * sort 由种子数组顺序决定（即 IPA_PHONEME_SEEDS 中的分组顺序）。
 */
async function seedIpaPhonemes(prisma: PrismaService): Promise<void> {
  let created = 0;
  for (const [index, seed] of IPA_PHONEME_SEEDS.entries()) {
    const existing = await prisma.ipaPhoneme.findUnique({ where: { symbol: seed.symbol }, select: { id: true } });
    if (!existing) {
      await prisma.ipaPhoneme.create({
        data: {
          symbol: seed.symbol,
          type: seed.type,
          exampleWords: JSON.stringify(seed.exampleWords),
          tips: seed.tips,
          sort: index,
        },
      });
      created += 1;
    }
  }
  logger.log(`音标库数据完成，共 ${IPA_PHONEME_SEEDS.length} 个（新建 ${created} 个）`);
}

/* --------------------------------- 成就种子 -------------------------------- */

/**
 * 微游戏化成就定义（code 为稳定业务键；判定逻辑在 GamifyService 的
 * `ACHIEVEMENT_CONDITIONS` 里按 code 关联）。
 *
 * 导出是为了让 `test/achievement-catalog.spec.ts` 能校验「定义 ↔ 判定」一一对应：
 * 只加定义不加判定不会报错，那枚勋章会永远解不开（静默失效）。
 */
export const ACHIEVEMENT_SEEDS: Array<{
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rewardXp: number;
  sort: number;
}> = [
  {
    code: 'first_step',
    name: '初次落笔',
    description: '完成第一次作答',
    icon: 'footprints',
    category: 'behavior',
    rewardXp: 10,
    sort: 1,
  },
  {
    code: 'streak_3',
    name: '小有恒心',
    description: '连续打卡 3 天',
    icon: 'flame',
    category: 'persist',
    rewardXp: 20,
    sort: 2,
  },
  {
    code: 'streak_7',
    name: '七日不辍',
    description: '连续打卡 7 天',
    // 原来是 'fire'——lucide 里没有这个名字（只有 flame / flame-kindling），
    // 客户端拼 `i-lucide-fire` 拿不到图标，勋章墙上这一枚是空白（2026-10-26 修）。
    icon: 'flame-kindling',
    category: 'persist',
    rewardXp: 50,
    sort: 3,
  },
  {
    code: 'streak_30',
    name: '月满',
    description: '连续打卡 30 天',
    icon: 'trophy',
    category: 'persist',
    rewardXp: 200,
    sort: 4,
  },
  {
    code: 'correct_50',
    name: '初露锋芒',
    description: '累计答对 50 题',
    icon: 'target',
    category: 'behavior',
    rewardXp: 30,
    sort: 5,
  },
  {
    code: 'correct_200',
    name: '熟能生巧',
    description: '累计答对 200 题',
    icon: 'award',
    category: 'behavior',
    rewardXp: 100,
    sort: 6,
  },
  {
    code: 'favorite_20',
    name: '收藏家',
    description: '收藏 20 句',
    icon: 'bookmark',
    category: 'behavior',
    rewardXp: 30,
    sort: 7,
  },
  {
    code: 'explorer_3',
    name: '初探',
    description: '解锁 3 个场景',
    icon: 'map',
    category: 'behavior',
    rewardXp: 30,
    sort: 8,
  },
  {
    code: 'explorer_all',
    name: '环游',
    description: '解锁全部场景',
    icon: 'globe',
    category: 'behavior',
    rewardXp: 150,
    sort: 9,
  },
  {
    code: 'level_b1',
    name: '进阶',
    description: '达到 B1 等级',
    icon: 'trending-up',
    category: 'persist',
    rewardXp: 50,
    sort: 10,
  },
  /* ---------------- 第二批（2026-10-26 扩充）：答题量 / 打卡 / 收藏 / 场景 / 等级 ---------------- */
  {
    code: 'answer_100',
    name: '百题之约',
    description: '累计作答 100 题',
    icon: 'notebook-pen',
    category: 'behavior',
    rewardXp: 40,
    sort: 11,
  },
  {
    code: 'answer_500',
    name: '五百题斩',
    description: '累计作答 500 题',
    icon: 'swords',
    category: 'behavior',
    rewardXp: 120,
    sort: 12,
  },
  {
    code: 'correct_500',
    name: '炉火纯青',
    description: '累计答对 500 题',
    icon: 'medal',
    category: 'behavior',
    rewardXp: 200,
    sort: 13,
  },
  {
    code: 'favorite_50',
    name: '藏句成癖',
    description: '收藏 50 句',
    icon: 'gem',
    category: 'behavior',
    rewardXp: 60,
    sort: 14,
  },
  {
    code: 'explorer_half',
    name: '半图已阅',
    description: '解锁一半场景',
    icon: 'compass',
    category: 'behavior',
    rewardXp: 60,
    sort: 15,
  },
  {
    code: 'streak_14',
    name: '两周不辍',
    description: '连续打卡 14 天',
    icon: 'calendar-check',
    category: 'persist',
    rewardXp: 80,
    sort: 16,
  },
  {
    code: 'streak_100',
    name: '百日之约',
    description: '连续打卡 100 天',
    icon: 'crown',
    category: 'persist',
    rewardXp: 500,
    sort: 17,
  },
  {
    code: 'level_b2',
    name: '高阶启程',
    description: '达到 B2 等级',
    icon: 'rocket',
    category: 'persist',
    rewardXp: 80,
    sort: 18,
  },
  // ---- 排行榜配套成就（与 /client/leaderboard 三个榜单维度一一对应） ----
  {
    code: 'today_answer_20',
    name: '今日勤学',
    description: '单日作答 20 题（答题榜）',
    icon: 'list-ordered',
    category: 'behavior',
    rewardXp: 30,
    sort: 19,
  },
  {
    code: 'today_answer_50',
    name: '题海争锋',
    description: '单日作答 50 题（答题榜）',
    icon: 'zap',
    category: 'behavior',
    rewardXp: 60,
    sort: 20,
  },
  {
    code: 'today_correct_15',
    name: '今日神准',
    description: '单日答对 15 题（答对榜）',
    icon: 'badge-check',
    category: 'behavior',
    rewardXp: 40,
    sort: 21,
  },
  {
    code: 'today_correct_30',
    name: '百步穿杨',
    description: '单日答对 30 题（答对榜）',
    icon: 'star',
    category: 'behavior',
    rewardXp: 80,
    sort: 22,
  },
  {
    code: 'checkin_total_30',
    name: '三十日课',
    description: '累计打卡 30 天（打卡榜）',
    icon: 'calendar-days',
    category: 'persist',
    rewardXp: 100,
    sort: 23,
  },
  {
    code: 'checkin_total_100',
    name: '百日恒心',
    description: '累计打卡 100 天（打卡榜）',
    icon: 'sparkles',
    category: 'persist',
    rewardXp: 300,
    sort: 24,
  },
  {
    code: 'rank_top100',
    name: '榜上有名',
    description: '首次登上任一排行榜前 100 名',
    icon: 'flag',
    category: 'behavior',
    rewardXp: 30,
    sort: 25,
  },
  {
    code: 'rank_top10',
    name: '十强之列',
    description: '登上任一排行榜前 10 名',
    icon: 'chevrons-up',
    category: 'behavior',
    rewardXp: 80,
    sort: 26,
  },
  {
    code: 'rank_top3',
    name: '三甲之列',
    description: '登上任一排行榜前三名',
    icon: 'trophy',
    category: 'persist',
    rewardXp: 100,
    sort: 27,
  },
  {
    code: 'rank_first',
    name: '榜首加冕',
    description: '登顶任一排行榜第 1 名',
    icon: 'crown',
    category: 'persist',
    rewardXp: 200,
    sort: 28,
  },
  {
    code: 'team_first',
    name: '并肩同行',
    description: '首次加入弱连接学习小队',
    icon: 'users-round',
    category: 'behavior',
    rewardXp: 20,
    sort: 29,
  },
  {
    code: 'team_full_3',
    name: '默契初成',
    description: '小队连续 3 天全员完成打卡',
    icon: 'handshake',
    category: 'persist',
    rewardXp: 50,
    sort: 30,
  },
  {
    code: 'team_full_7',
    name: '同心之约',
    description: '小队连续 7 天全员完成打卡',
    icon: 'trophy',
    category: 'persist',
    rewardXp: 120,
    sort: 31,
  },
  {
    code: 'stage_first',
    name: '第一章落笔',
    description: '通关任意一个情景关卡',
    icon: 'map',
    category: 'explore',
    rewardXp: 60,
    sort: 32,
  },
  {
    code: 'stage_all',
    name: '全境通关',
    description: '通关全部情景关卡',
    icon: 'route',
    category: 'persist',
    rewardXp: 300,
    sort: 33,
  },
];

/** 写入成就定义（幂等：按 code upsert，元数据随发布更新）。 */
async function seedAchievements(prisma: PrismaService): Promise<void> {
  for (const seed of ACHIEVEMENT_SEEDS) {
    await prisma.achievement.upsert({
      where: { code: seed.code },
      create: seed,
      update: {
        name: seed.name,
        description: seed.description,
        icon: seed.icon,
        category: seed.category,
        rewardXp: seed.rewardXp,
        sort: seed.sort,
      },
    });
  }
  logger.log(`成就数据完成，共 ${ACHIEVEMENT_SEEDS.length} 个`);
}

/**
 * 种子服务：在应用启动时执行种子（早于 app.listen 接受请求）。
 * 即早于 app.listen 接受请求）。
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await runSeed(this.prisma);
  }
}
