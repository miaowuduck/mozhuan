# 部署指南

本项目是一个纯静态的前端应用（HTML/CSS/JS），因此部署非常简单。你可以选择以下任意一种方式进行部署。

## 方案一：使用 Vercel (推荐)

Vercel 是部署静态网站最简单、最快的方式之一，且提供免费的 HTTPS 支持。

1.  访问 [Vercel](https://vercel.com/) 并注册/登录。
2.  点击 **"Add New..."** -> **"Project"**。
3.  **导入项目**：
    *   如果你的代码在 GitHub/GitLab/Bitbucket 上，直接连接并导入仓库。
    *   如果代码在本地，可以安装 Vercel CLI (`npm i -g vercel`) 然后在项目根目录运行 `vercel` 命令。
4.  **配置**：
    *   Framework Preset: 选择 **Other** (因为是原生 JS)。
    *   Root Directory: `./` (默认即可)。
5.  点击 **Deploy**。

## 方案二：使用 GitHub Pages

如果你的代码托管在 GitHub 上：

1.  进入你的 GitHub 仓库页面。
2.  点击 **Settings** (设置) -> **Pages** (左侧菜单)。
3.  在 **Build and deployment** 下：
    *   Source: 选择 **Deploy from a branch**。
    *   Branch: 选择 `main` (或 `master`) 分支，文件夹选择 `/ (root)`。
4.  点击 **Save**。
5.  等待几分钟，GitHub 会给出一个访问链接（如 `https://username.github.io/repo-name/`）。

## 方案三：使用 Netlify

Netlify 与 Vercel 类似，支持拖拽部署。

1.  访问 [Netlify](https://www.netlify.com/) 并注册/登录。
2.  在 Dashboard 页面，找到 **"Sites"**。
3.  直接将你的项目文件夹（包含 `index.html` 的那个文件夹）**拖拽**到浏览器窗口中。
4.  Netlify 会自动上传并生成一个随机域名的网站（你可以稍后修改域名）。

## 方案四：传统 Web 服务器 (Nginx/Apache/IIS)

如果你有自己的服务器：

1.  将项目所有文件上传到服务器的 Web 根目录（例如 `/var/www/html/`）。
2.  配置 Web 服务器指向 `index.html`。
3.  **重要**：确保配置了 **HTTPS**。
    *   由于本项目使用了 PWA (Manifest) 和可能的摄像头功能，浏览器要求必须在 HTTPS 环境下（或 `localhost`）才能正常工作。
    *   可以使用 Let's Encrypt 申请免费证书。

## 常见问题

### 1. 为什么摄像头打不开？
请检查你是否使用了 HTTPS 协议访问网站。现代浏览器出于安全考虑，禁止在非 HTTPS 环境（localhost 除外）下调用摄像头。

### 2. 为什么 API 请求失败？
*   检查你的 API Key 和 API URL 是否正确填写。
*   检查是否存在 **CORS (跨域)** 问题。如果你使用的 API 服务不支持从浏览器直接跨域调用，你可能需要配置一个反向代理，或者使用支持 CORS 的 API 服务。

### 3. 手机上图标没有显示？
请确保 `manifest.json` 中的图标路径正确，并且文件已成功上传到服务器。
