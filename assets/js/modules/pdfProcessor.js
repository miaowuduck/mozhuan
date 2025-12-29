// --- 2. 核心逻辑: PDF 处理 ---
export class PDFProcessor {
    constructor(service) { this.service = service; }
  
    async renderPage(page) {
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    }
  
    async processPage(page, topic, contextStr, config, log, streamUpdate) {
      log("正在渲染页面...");
      const imgB64 = await this.renderPage(page);
  
      // --- 构建 Prompt (完全对齐 Python 版) ---
      let contextInstruction = "";
      if (contextStr) {
        contextInstruction = `
              **PREVIOUS CONTEXT (For Reference Only):**
              Use this to understand the flow, but focus on the new page.
              (Note: Previous diagrams are represented as placeholders like [Image Diagram: ...])
              --- BEGIN CONTEXT ---
              ${contextStr}
              --- END CONTEXT ---
              `;
      }
  
      let languageInstruction = "";
      if (config.lang === "全中文") {
        languageInstruction = "Output the study guide in only Simplified Chinese. Translate if necessary.";
      } else if (config.lang === "全英文") {
        languageInstruction = "Output the study guide in only English. Translate if necessary.";
      } else if (config.lang === "中英双语") {
        languageInstruction = "Output the study guide in Bilingual format. For every paragraph or section, write it first in Simplified Chinese, followed immediately by the English version.";
      } else if (config.lang === "自动") {
        languageInstruction = "";
      } else {
        // Default fallback
        languageInstruction = "Output the study guide in Simplified Chinese. Translate if necessary.";
      }
  
      let drawingInstruction = "";
      if (config.drawing) {
        drawingInstruction = `
          3. **Complex Visuals:** If a graph, circuit, or complex illustration CANNOT be expressed as text/LaTeX or Mermaid, you MUST preserve it by inserting a tag:
             \`<image>VISUAL DESCRIPTION<image>\`
             **IMPORTANT:** Do NOT duplicate the content. If it's in an \`<image>\` tag, do not write it again in the text.
          
          4. **HOW TO WRITE THE VISUAL DESCRIPTION:**
             **WARNING:** The artist who draws the image will NOT see the original note. They rely 100% on your text.
             You must describe every detail explicitly:
             - **For Diagrams:** Name axes, describe curves/shapes, list labels, and specify type (e.g., "Circuit Diagram").
              `;
      }
  
      const prompt = `
          You are an expert academic tutor. 
          The overall topic is: **"${topic}"**.
  
          ${languageInstruction}
  
          ${contextInstruction}
  
          **Your Task:**
          Analyze the handwritten notes in the attached image and convert them into a Markdown study guide.
          - **Logical Flow:** If there are slight logical gaps in the handwritten notes, add *brief* explanations to make the study guide flow better. Do not add too much external content, just enough to connect the dots.
  
          **LATEX FORMATTING RULES:**
          - LaTeX must be wrapped in \`$\`.
          - Use \`$\` for inline formulas.
          - Use \`$$\` for block formulas.
          - Block formulas will not be centered, so do not use multiple consecutive block formulas if they need to be centered/aligned.
  
          **CRITICAL INSTRUCTIONS FOR DIAGRAMS AND COMPLEX CONTENT:**
          1. **Text Flow:** Transcribe standard text and ALL math/formulas (LaTeX) normally.
          2. **Mermaid Diagrams:** If a diagram (like a flowchart, sequence diagram, class diagram, state diagram, entity relationship diagram, etc.) can be represented using Mermaid syntax, please use a Mermaid code block.
             Example:
             \`\`\`mermaid
             graph TD;
                 A-->B;
             \`\`\`
          ${drawingInstruction}
  
          **Output:** Return ONLY the Markdown content.
          `;
  
      log("AI 正在分析 (流式)...");
      let rawText = "";
      const generator = this.service.analyzeImage(imgB64, prompt, "gemini-3-pro-preview");
  
      for await (const chunk of generator) {
        rawText += chunk;
        streamUpdate(chunk);
      }
  
      // 清理思维链内容
      let content = rawText.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim();
  
      if (config.drawing && content.includes('<image>')) {
        log("🎨 正在生成插图...");
        content = await this.processImages(content, log);
      }
      return content;
    }
  
    async processImages(text, log) {
      const matches = [...text.matchAll(/<image>(.*?)<image>/gs)];
      let newText = text;
      for (const match of matches) {
        const desc = match[1];
        log(`正在绘制: ${desc.substring(0, 20)}...`);
  
        const finalPrompt = `You are a professional scientific illustrator. Your task is to generate a high-quality, clean, digital scientific diagram based strictly on the following description.
  
  **DESCRIPTION:**
  ${desc}
  
  **DESIGN REQUIREMENTS:**
  1. **STYLE:** Clean, flat 2D vector-style illustration on a pure WHITE background.
  2. **CLARITY:** Black lines, legible digital text (Arial/LaTeX style).
  3. **ACCURACY:** Strictly follow axes and shapes in the description.
  4. **NO ARTIFACTS:** No handwriting style, no paper texture.`;
  
        const b64 = await this.service.generateImage(finalPrompt, "gemini-3-pro-image-preview");
        if (b64) {
          const safeDesc = desc.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, ' ').substring(0, 30);
          newText = newText.replace(match[0], `![${safeDesc}](data:image/jpeg;base64,${b64})`);
        }
      }
      return newText;
    }
  }
