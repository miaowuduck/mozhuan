# 智能笔记转换（网页工程）

本项目将原来的单文件页面拆分为标准的前端工程结构，便于维护与扩展。

## 结构
- `index.html`：入口页面，加载资源与初始化 UI
- `assets/css/style.css`：全局样式
- `assets/js/main.js`：核心逻辑（PDF 渲染、API 通信与交互）
- `assets/img/`：图片资源占位目录

## 使用方式
1. 推荐使用 VS Code 安装 Live Server 扩展，在 `index.html` 上右键「Open with Live Server」。
2. 或者直接双击 `index.html` 用浏览器打开（注意某些功能可能因浏览器安全策略受限）。

## 注意事项
- 需要正确填写 API Key 与 API URL（脚本会强制将 `http://` 转为 `https://`）。
- 如果遇到 CORS/SSL 错误，请通过本地服务器预览页面（如 Live Server），并确保目标域名支持 HTTPS。
- 页面使用 PDF.js CDN，请保持网络连通。

## 后续可扩展
- 使用构建工具（如 Vite/Webpack）管理依赖与打包。
- 将内联 `style` 属性进一步抽到 CSS。
- 增加错误上报与缓存机制。
