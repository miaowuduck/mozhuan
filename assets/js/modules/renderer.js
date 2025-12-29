// 渲染 Markdown, LaTeX 和 Mermaid
export async function renderContent(element, markdown, service = null, logger = null) {
    // 1. Markdown -> HTML
    // 使用 marked 解析
    element.innerHTML = marked.parse(markdown);
  
    // 2. 处理 Mermaid 代码块
    // marked 渲染出的代码块是 <pre><code class="language-mermaid">...</code></pre>
    // 我们需要将其转换为 <div class="mermaid">...</div>
    const mermaidBlocks = element.querySelectorAll('pre code.language-mermaid');
    mermaidBlocks.forEach(block => {
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = block.textContent;
      // 替换整个 pre 标签
      block.parentElement.replaceWith(div);
    });
  
    // 3. 渲染 Mermaid
    let newMarkdown = markdown;
    let hasUpdates = false;
  
    try {
      const mermaidDivs = element.querySelectorAll('.mermaid');
      if (mermaidDivs.length > 0) {
          await mermaid.run({ nodes: mermaidDivs });
      }
    } catch (e) {
      console.warn('Mermaid 渲染错误:', e);
      if (logger) logger(`Mermaid 渲染错误: ${e.message}`);
      
      // 尝试自动修复
      if (service) {
          console.log("尝试自动修复 Mermaid...");
          if (logger) logger("尝试自动修复 Mermaid...");
          const tokens = marked.lexer(markdown);
          
          for (const token of tokens) {
              if (token.type === 'code' && token.lang === 'mermaid') {
                  try {
                      // 验证语法
                      await mermaid.parse(token.text);
                  } catch (parseErr) {
                      console.log("发现错误的 Mermaid 代码:", token.text);
                      if (logger) logger(`发现错误的 Mermaid 代码，正在修复... 原因: ${parseErr.message}`);
                      const fixedCode = await service.fixMermaid(token.text, parseErr.message);
                      if (fixedCode && fixedCode !== token.text) {
                          // 替换原文中的代码块
                          // 注意：简单的 replace 可能会替换错误的实例，如果完全相同的代码块出现多次。
                          // 但通常损坏的代码是独特的。
                          newMarkdown = newMarkdown.replace(token.text, fixedCode);
                          hasUpdates = true;
                          console.log("Mermaid 已修复");
                          if (logger) logger("Mermaid 已修复");
                      }
                  }
              }
          }
      }
    }
  
    // 4. 渲染 LaTeX
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(element, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false
      });
    }
  
    // 如果有修复，递归调用以重新渲染（不带 service 防止死循环）
    if (hasUpdates) {
        return renderContent(element, newMarkdown, null, logger);
    }
    
    return newMarkdown;
  }
