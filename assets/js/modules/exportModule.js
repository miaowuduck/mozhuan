
// 辅助函数：裁切 Canvas 透明边缘
function cropCanvas(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;
    try {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        let minX = width, minY = height, maxX = 0, maxY = 0;
        let found = false;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const alpha = data[(y * width + x) * 4 + 3];
                if (alpha > 0) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    found = true;
                }
            }
        }

        if (!found) return canvas; 

        const padding = 2;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(width, maxX + padding);
        maxY = Math.min(height, maxY + padding);

        const cropWidth = maxX - minX;
        const cropHeight = maxY - minY;

        if (cropWidth <= 0 || cropHeight <= 0) return canvas;

        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;
        const croppedCtx = croppedCanvas.getContext('2d');
        
        croppedCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        return croppedCanvas;
    } catch (e) {
        console.warn('Canvas 裁切失败:', e);
        return canvas;
    }
}

// 辅助函数：将 Mermaid 图表转换为图片
async function processMermaidImages(sourceElement, targetElement) {
    if (!window.html2canvas) return;

    const originalMermaids = sourceElement.querySelectorAll('.mermaid');
    const targetMermaids = targetElement.querySelectorAll('.mermaid');

    if (originalMermaids.length > 0 && originalMermaids.length === targetMermaids.length) {
        // 串行处理以避免浏览器卡顿
        for (let i = 0; i < originalMermaids.length; i++) {
            try {
                const scale = 2;
                const canvas = await html2canvas(originalMermaids[i], {
                    backgroundColor: null,
                    scale: scale, // 提高清晰度
                    logging: false
                });
                
                const croppedCanvas = cropCanvas(canvas);
                const imgData = croppedCanvas.toDataURL('image/png');
                
                const img = document.createElement('img');
                img.src = imgData;
                
                // 计算显示宽度：裁切后的宽度 / 缩放比例
                const displayWidth = croppedCanvas.width / scale;
                const displayHeight = croppedCanvas.height / scale;
                img.width = displayWidth;
                img.height = displayHeight;
                img.style.maxWidth = '100%';
                
                // 替换目标中的内容
                targetMermaids[i].innerHTML = '';
                targetMermaids[i].appendChild(img);
                targetMermaids[i].style.textAlign = 'center';
            } catch (e) {
                console.warn('Mermaid 转换图片失败:', e);
            }
        }
    }
}

// 辅助函数：处理 LaTeX 公式，转换为 MathML 以供 Word 识别
function processLatexForWord(element) {
    const katexNodes = element.querySelectorAll('.katex');
    
    katexNodes.forEach(node => {
        let success = false;
        
        // 尝试使用 MathJax (如果可用) 以获得更好的 Word 兼容性
        // 这模仿了 LaTex2Word-Equation 的核心逻辑：使用 MathJax 生成兼容 Word 的 MathML
        if (window.MathJax && window.MathJax.tex2mml) {
            try {
                // 从 KaTeX 渲染结果中提取原始 LaTeX 代码
                const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
                const latex = annotation ? annotation.textContent : null;
                
                if (latex) {
                    const mathmlString = MathJax.tex2mml(latex);
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = mathmlString;
                    const mathmlElement = tempDiv.firstElementChild;
                    
                    if (mathmlElement) {
                        if (!mathmlElement.getAttribute('xmlns')) {
                            mathmlElement.setAttribute('xmlns', 'http://www.w3.org/1998/Math/MathML');
                        }
                        // 移除 MathJax 可能添加的样式，确保内联显示
                        mathmlElement.style.display = 'inline';
                        node.replaceWith(mathmlElement);
                        success = true;
                    }
                }
            } catch (e) {
                console.warn('MathJax 转换失败，回退到 KaTeX MathML:', e);
            }
        }

        if (!success) {
            // 回退：使用 KaTeX 自带的 MathML
            // KaTeX 渲染结构: .katex > .katex-mathml > math
            const mathml = node.querySelector('.katex-mathml math');
            if (mathml) {
                // 确保有正确的命名空间
                if (!mathml.getAttribute('xmlns')) {
                    mathml.setAttribute('xmlns', 'http://www.w3.org/1998/Math/MathML');
                }
                
                // 移除可能导致隐藏的类和样式
                mathml.removeAttribute('class');
                mathml.style.display = 'inline';
                mathml.style.visibility = 'visible';

                // 替换节点
                node.replaceWith(mathml);
            }
        }
    });
}

// 导出为 HTML
export async function exportToHTML(element, filename) {
    const header = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
    img { max-width: 100%; height: auto; }
    .mermaid { text-align: center; }
    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    code { font-family: monospace; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 8px; }
    th { background-color: #f2f2f2; }
    blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 16px; color: #666; }
  </style>
</head>
<body>
`;
    const footer = "</body></html>";
    
    // 克隆节点以进行修改，不影响页面显示
    const clone = element.cloneNode(true);
    
    // 1. 修复普通图片尺寸
    fixImagesForWord(element, clone);

    // 2. 将 Mermaid 转换为图片
    await processMermaidImages(element, clone);
    
    const sourceHTML = header + clone.innerHTML + footer;
    
    const blob = new Blob([sourceHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = url;
    fileDownload.download = filename + '.html';
    fileDownload.click();
    document.body.removeChild(fileDownload);
    URL.revokeObjectURL(url);
}

// 辅助函数：处理普通图片，固定尺寸防止 Word 中变形
function fixImagesForWord(sourceElement, targetElement) {
    const sourceImages = sourceElement.querySelectorAll('img');
    const targetImages = targetElement.querySelectorAll('img');

    if (sourceImages.length === targetImages.length) {
        for (let i = 0; i < sourceImages.length; i++) {
            const sourceImg = sourceImages[i];
            const targetImg = targetImages[i];

            // 获取显示尺寸
            const rect = sourceImg.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;

            if (width > 0 && height > 0) {
                // 设置 HTML 属性
                targetImg.setAttribute('width', Math.round(width));
                targetImg.setAttribute('height', Math.round(height));
                
                // 设置内联样式，覆盖可能的 CSS 限制
                targetImg.style.width = `${Math.round(width)}px`;
                targetImg.style.height = `${Math.round(height)}px`;
                targetImg.style.maxWidth = 'none';
                targetImg.style.maxHeight = 'none';
            }
        }
    }
}

// 导出为 Word
export async function exportToWord(element, filename) {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
            "xmlns:w='urn:schemas-microsoft-com:office:word' " +
            "xmlns:m='http://schemas.microsoft.com/office/2004/12/omml' " +
            "xmlns='http://www.w3.org/TR/REC-html40'>" +
            "<head><meta charset='utf-8'><title>Export HTML to Word Document with JavaScript</title></head><body>";
    const footer = "</body></html>";
    
    // 克隆节点以进行修改，不影响页面显示
    const clone = element.cloneNode(true);
    
    // 1. 修复普通图片尺寸（在处理 Mermaid 之前，确保 img 数量一致）
    fixImagesForWord(element, clone);

    // 2. 将 Mermaid 转换为图片
    await processMermaidImages(element, clone);

    // 2. 将 LaTeX 转换为 MathML
    processLatexForWord(clone);
    
    const sourceHTML = header + clone.innerHTML + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = filename + '.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
}
