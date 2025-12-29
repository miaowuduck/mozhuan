import { configureGlobals, debounce } from './modules/utils.js';
import { renderContent } from './modules/renderer.js';
import { GeminiService } from './modules/geminiService.js';
import { PDFProcessor } from './modules/pdfProcessor.js';
import { initCameraModule } from './modules/cameraModule.js';
import { exportToHTML, exportToWord } from './modules/exportModule.js';

// 初始化全局配置
configureGlobals();

// 初始化摄像头模块
initCameraModule();

// --- Settings Management ---
const SETTINGS_KEY = 'mozhuang_settings';
const settingsInputs = ['apiKey', 'apiUrl', 'targetLanguage', 'logicMode', 'contextPages', 'drawingMode'];

function loadSettings() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            settingsInputs.forEach(id => {
                const el = document.getElementById(id);
                if (el && settings[id] !== undefined) {
                    el.value = settings[id];
                }
            });
        } catch (e) {
            console.error("Failed to load settings", e);
        }
    }
}

function saveSettings() {
    const settings = {};
    settingsInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            settings[id] = el.value;
        }
    });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Bind settings events
settingsInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('change', saveSettings);
        el.addEventListener('input', debounce(saveSettings, 500));
    }
});

// Settings Drawer Logic
const settingsBtn = document.getElementById('settingsToggleBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsDrawer = document.getElementById('settingsDrawer');
const settingsBackdrop = document.getElementById('settingsBackdrop');

function toggleSettings(show) {
    if (show) {
        settingsDrawer.classList.add('active');
        settingsBackdrop.classList.add('active');
    } else {
        settingsDrawer.classList.remove('active');
        settingsBackdrop.classList.remove('active');
    }
}

if (settingsBtn) settingsBtn.onclick = () => toggleSettings(true);
if (closeSettingsBtn) closeSettingsBtn.onclick = () => toggleSettings(false);
if (settingsBackdrop) settingsBackdrop.onclick = () => toggleSettings(false);

// Load settings on startup
loadSettings();

// Check for API Key and show setup modal if missing
const setupModal = document.getElementById('setupModal');
const setupApiKeyInput = document.getElementById('setupApiKey');
const setupApiUrlInput = document.getElementById('setupApiUrl');
const saveSetupBtn = document.getElementById('saveSetupBtn');

if (setupModal && setupApiKeyInput && setupApiUrlInput && saveSetupBtn) {
    const currentApiKey = document.getElementById('apiKey').value;
    
    if (!currentApiKey) {
        setupModal.style.display = 'block';
        // Ensure default API URL is set if empty
        if (!setupApiUrlInput.value) {
            setupApiUrlInput.value = 'https://jeniya.cn';
        }
    }

    saveSetupBtn.onclick = () => {
        const newApiKey = setupApiKeyInput.value.trim();
        const newApiUrl = setupApiUrlInput.value.trim();

        if (!newApiKey) {
            alert('请输入 API Key');
            return;
        }

        // Update main settings inputs
        const mainApiKeyInput = document.getElementById('apiKey');
        const mainApiUrlInput = document.getElementById('apiUrl');

        if (mainApiKeyInput) mainApiKeyInput.value = newApiKey;
        if (mainApiUrlInput) mainApiUrlInput.value = newApiUrl || 'https://jeniya.cn';

        // Save settings
        saveSettings();

        // Hide modal
        setupModal.style.display = 'none';
    };
}

// 监听文件选择
(function attachFileListener(){
  const fileInput = document.getElementById('fileInput');
  if (!fileInput) return; // 兜底以免脚本提前执行
  fileInput.addEventListener('change', (e) => {
    const list = document.getElementById('fileList');
    list.innerHTML = '';
    Array.from(e.target.files).forEach((f, i) => {
      list.innerHTML += `
                <div class="card" id="file-card-${i}" style="border:1px solid #eee; margin-top:10px;">
                    <div class="file-header">
                        <div class="file-info">
                            <strong>${f.name}</strong>
                            <div class="processing-status">正在处理中... <span class="thinking-dots"><span></span><span></span><span></span></span></div>
                        </div>
                        <input type="text" id="topic-${i}" class="topic-input" placeholder="请填写笔记主题">
                    </div>
                    
                    <div style="margin-top: 10px;">
                        <button class="toggle-btn" onclick="toggleSection('log-${i}')">日志</button>
                        <button class="toggle-btn" onclick="toggleSection('preview-${i}')">预览</button>
                    </div>

                    <div class="log-box collapsed" id="log-${i}">等待开始...</div>
                    <div class="preview-box" id="preview-${i}"></div>
                </div>`;
    });
  });
})();

// 全局切换函数
window.toggleSection = function(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.toggle('collapsed');
    }
};

async function main() {
  // 重置错误
  const errBox = document.getElementById('globalError');
  errBox.style.display = 'none';
  errBox.textContent = '';

  const apiKey = document.getElementById('apiKey').value;
  const apiUrl = document.getElementById('apiUrl').value;
  const files = document.getElementById('fileInput').files;

  if (!files.length) return alert("请先上传文件");

  const btn = document.getElementById('startBtn');
  btn.disabled = true;
  btn.textContent = "处理中...";

  // 2. 一旦开始转换不允许新上传文件
  const fileInputLabel = document.getElementById('fileInputLabel');
  const cameraBtn = document.getElementById('cameraBtn');
  if (fileInputLabel) fileInputLabel.classList.add('disabled');
  if (cameraBtn) cameraBtn.disabled = true;

  // 3. 转换过程中提醒用户不要刷新或者关闭网页
  window.onbeforeunload = function() {
      return "正在转换中，请勿关闭或刷新页面";
  };

  const service = new GeminiService(apiKey, apiUrl);
  const processor = new PDFProcessor(service);
  const config = {
    lang: document.getElementById('targetLanguage').value,
    logic: document.getElementById('logicMode').value,
    ctxLen: parseInt(document.getElementById('contextPages').value),
    drawing: document.getElementById('drawingMode').value === 'true'
  };

  const tasks = Array.from(files).map(async (file, idx) => {
    const cardEl = document.getElementById(`file-card-${idx}`);
    const logEl = document.getElementById(`log-${idx}`);
    const prevEl = document.getElementById(`preview-${idx}`);
    const topic = document.getElementById(`topic-${idx}`).value.trim() || "通用笔记";
    
    // 开启任务动画
    cardEl.classList.add('processing');

    const log = (msg) => {
      logEl.innerHTML += `<div>> ${msg}</div>`;
      logEl.scrollTop = logEl.scrollHeight;
    };

    try {
      log("正在读取文件...");
      const buff = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(buff).promise;

      let fullMd = `# ${topic}\n\n`;
      let history = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        log(`处理第 ${i}/${pdf.numPages} 页...`);
        const ctxStr = history.slice(-config.ctxLen).join('\n');

        let pageMarkdown = "";
        
        // 显示思考中状态
        const thinkingMd = `\n\n<div class="thinking-indicator">AI 正在思考中...<div class="thinking-dots"><span></span><span></span><span></span></div></div>`;
        await renderContent(prevEl, fullMd + thinkingMd);
        prevEl.scrollTop = prevEl.scrollHeight;

        // 创建防抖渲染函数
        const debouncedRender = debounce(() => {
             renderContent(prevEl, fullMd + pageMarkdown);
             prevEl.scrollTop = prevEl.scrollHeight;
        }, 200);

        const pageText = await processor.processPage(
          await pdf.getPage(i), topic, ctxStr, config, log,
          (chunk) => { 
              pageMarkdown += chunk;
              debouncedRender();
          }
        );

        fullMd += pageText + "\n\n---\n\n";
        pageMarkdown = ""; // 防止防抖函数再次渲染导致重复
        // 确保本页完成后，再次渲染（包含可能生成的图片），并尝试修复 Mermaid
        fullMd = await renderContent(prevEl, fullMd, service, log);

        // 清理图片标记用于上下文
        history.push(pageText.replace(/!\[.*?\]\(.*?\)/g, '').replace(/<image>.*?<\/image>/gs, ''));
      }

      log("✅ 完成！");
      cardEl.classList.remove('processing');

      // 生成下载按钮区域
      const actionArea = document.createElement('div');
      actionArea.style.marginTop = '10px';
      actionArea.style.display = 'flex';
      actionArea.style.gap = '10px';

      // 1. Markdown 下载
      const blob = new Blob([fullMd], {type: 'text/markdown'});
      const url = URL.createObjectURL(blob);
      const dlBtn = document.createElement('a');
      dlBtn.href = url;
      dlBtn.download = `${file.name.replace('.pdf', '')}.md`;
      dlBtn.textContent = `下载 Markdown`;
      dlBtn.className = 'btn-like btn-secondary'; 
      dlBtn.style.textDecoration = 'none';
      dlBtn.style.color = 'white';
      
      // 2. HTML 导出
      const htmlBtn = document.createElement('button');
      htmlBtn.textContent = '导出 HTML';
      htmlBtn.className = 'btn-like btn-danger';
      htmlBtn.onclick = () => exportToHTML(prevEl, file.name.replace('.pdf', ''));

      // 3. Word 导出
      const wordBtn = document.createElement('button');
      wordBtn.textContent = '导出 Word';
      wordBtn.className = 'btn-like';
      wordBtn.onclick = () => exportToWord(prevEl, file.name.replace('.pdf', ''));

      actionArea.appendChild(dlBtn);
      actionArea.appendChild(htmlBtn);
      actionArea.appendChild(wordBtn);
      
      document.getElementById(`file-card-${idx}`).appendChild(actionArea);

    } catch (e) {
      log(`❌ 错误: ${e.message}`);
      console.error(e);
      cardEl.classList.remove('processing');

      // 专门捕获 CORS 错误
      if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        errBox.style.display = 'block';
        errBox.innerHTML = `
                        <strong>网络错误 (CORS/SSL):</strong><br>
                        1. 你的 API URL 被强制转换为 HTTPS (${service.apiUrl})，请确保该域名支持 HTTPS。<br>
                        2. 如果你在本地直接双击打开文件 (file://)，请尝试使用 VS Code 的 "Live Server" 插件运行。<br>
                        3. 浏览器安全策略可能阻止了对 ${service.apiUrl} 的访问。
                    `;
      }
    }
  });

  await Promise.all(tasks);
  btn.disabled = false;
  btn.textContent = "开始转换";

  // 恢复上传按钮状态
  if (fileInputLabel) fileInputLabel.classList.remove('disabled');
  if (cameraBtn) cameraBtn.disabled = false;

  // 移除页面关闭提醒
  window.onbeforeunload = null;
}

// 将 main 函数暴露给全局作用域，以便 HTML 中的 onclick 调用
window.main = main;

