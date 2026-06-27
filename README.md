# Glosc Chat Website

这是 Glosc Chat 的官网分支，使用 Vue 3、Vue Router、Tailwind CSS 和 Vite 构建。

官网内容基于 `docs/` 中的产品、设计和开发文档整理，当前包含：

- 首页：产品定位、核心价值、隐私边界和使用流程。
- 技术支持：反馈方式、常见排障和提交问题所需信息。
- 隐私政策：本地数据、API Key、Provider 请求和导出数据说明。
- 服务条款：客户端、第三方模型 Provider 和用户责任边界。

## 本地开发

```bash
npm install
npm run dev
```

默认开发端口优先使用 `1420`。如果端口被占用，Vite 会自动切换到下一个可用端口。

## 构建验证

```bash
npm run build
```

构建产物输出到 `dist/`。

## GitHub Pages 部署

仓库已配置 GitHub Actions：推送到 `web` 分支或手动运行 `Deploy GitHub Pages` workflow 时，会自动构建并部署到 GitHub Pages。

首次启用时，在 GitHub 仓库中进入 `Settings` → `Pages`，将 `Build and deployment` 的 `Source` 设为 `GitHub Actions`。

默认 Pages 地址按项目页配置：

```text
https://glosc-ai.github.io/Glosc-Chat/
```

对应 workflow 会使用：

```text
VITE_BASE_PATH=/Glosc-Chat/
```

如果后续绑定自定义域名并部署到根路径，把 `.github/workflows/github-pages.yml` 中的 `VITE_BASE_PATH` 改为 `/`。

本地模拟 GitHub Pages 构建：

```bash
VITE_BASE_PATH=/Glosc-Chat/ npm run build:github-pages
```

## 主要目录

```text
src/
  components/   # 全站布局、页头、产品预览组件
  pages/        # 首页、技术支持、隐私政策、服务条款
  router/       # Vue Router 配置
  styles/       # Tailwind 入口和全局样式
```
