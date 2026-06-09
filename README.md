# 极简错题复习

一个用于数学/英语错题管理和间隔复习的轻量级 Web 应用。项目基于 Vue 3、Vite、Pinia 和 Vue Router 构建，数据保存在浏览器 `localStorage` 中，适合个人在本机或静态服务器上使用。

## 功能特性

- 今日记录：快速录入题号、科目、章节和备注，当天记录的题目会在次日进入复习。
- 今日复习：只需要标记“做对”或“做错”，降低复习时的操作成本。
- 间隔复习：做对后按 3、7、14、30、60、90 天推进复习阶段；错题次数越多，后续间隔会适当缩短。
- 错题追踪：记录错误次数、连续做对次数、当前阶段和下次复习日期。
- 全部题目：支持按科目、章节、状态筛选，并可归档、恢复或删除题目。
- 本地存储：无需后端服务，浏览器会自动保存题目数据。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Vitest

## 本地开发

```sh
pnpm install
pnpm dev
```

默认开发地址为 `http://localhost:5173`。

## 测试与构建

```sh
pnpm test
pnpm build
```

构建产物会输出到 `dist/`，可直接部署到 Nginx、OSS 静态网站或其他静态托管服务。

## 项目结构

```text
src/
  components/   通用组件
  router/       路由配置
  stores/       错题数据与复习逻辑
  types/        TypeScript 类型
  utils/        日期工具
  views/        页面视图
deploy/         部署配置示例
```

## 阿里云 ECS + Nginx 部署

项目已提供 Nginx SPA 配置模板：

```text
deploy/nginx.math-review.conf
```

部署步骤见：

```text
DEPLOYMENT.md
```

核心要求是将 `dist/` 内容放到 `/var/www/math-review`，并在 Nginx 中使用：

```nginx
try_files $uri $uri/ /index.html;
```

这样刷新 `/review`、`/problems` 等前端路由时不会出现 404。

## 数据说明

题目数据保存在当前浏览器的 `localStorage` 中，key 为 `simple-review-problems`。更换浏览器、清除站点数据或更换设备后，本地数据不会自动同步。
