// --- 1. 服务层: 负责与 API 通信 ---
export class GeminiService {
    constructor(apiKey, apiUrl) {
      this.apiKey = apiKey;
      // 强制修复 URL：移除末尾斜杠
      this.apiUrl = apiUrl.replace(/\/$/, '');
    }
  
    async *analyzeImage(imageB64, promptText, model = "gemini-3-pro-preview") {
      const url = `${this.apiUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse`;
  
      const payload = {
        contents: [{
          role: "user",
          parts: [
            { inline_data: { mime_type: "image/jpeg", data: imageB64 } },
            { text: promptText }
          ]
        }],
        generationConfig: { 
          thinkingConfig: { 
            includeThoughts: false,
            thinkingBudget: 64
          } 
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" }
        ]
      };
  
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'Accept': 'text/event-stream'
          },
          body: JSON.stringify(payload)
        });
  
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API 请求失败 [${response.status}]: ${errText.substring(0, 100)}`);
        }
  
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
  
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
  
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
  
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.substring(6);
                const chunk = JSON.parse(jsonStr);
                const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) yield text;
              } catch (e) { /* 忽略心跳包 */ }
            }
          }
        }
      } catch (e) {
        console.error("网络请求错误:", e);
        throw e; // 向上传递错误以便 UI 显示
      }
    }
  
    async generateImage(prompt, model = "gemini-3-pro-image-preview") {
      const url = `${this.apiUrl}/v1beta/models/${model}:generateContent`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { imageSize: "1K" } }
          })
        });
        if (!response.ok) throw new Error(`图片生成失败: ${response.status}`);
        const result = await response.json();
        const parts = result.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inline_data) return part.inline_data.data;
          if (part.inlineData) return part.inlineData.data;
        }
        return null;
      } catch (e) {
        console.error("图片生成错误:", e);
        return null;
      }
    }
  
    async fixMermaid(code, errorMsg) {
      const url = `${this.apiUrl}/v1beta/models/gemini-3-flash-preview:generateContent`;
      const prompt = `
  You are a Mermaid Diagram expert. The following code has a syntax error:
  Error: "${errorMsg}"
  
  Code:
  \`\`\`mermaid
  ${code}
  \`\`\`
  
  Please fix the code. 
  1. Return ONLY the fixed Mermaid code.
  2. Wrap it in a \`\`\`mermaid code block.
  3. Do not change the logic/content if possible, just fix the syntax.
  `;
  
      try {
          const response = await fetch(url, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${this.apiKey}`
              },
              body: JSON.stringify({
                  contents: [{ role: "user", parts: [{ text: prompt }] }],
                  generationConfig: {
                      thinkingConfig: {
                          includeThoughts: false,
                          thinkingBudget: 64
                      }
                  }
              })
          });
          
          if (!response.ok) throw new Error("Fix request failed");
          
          const result = await response.json();
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
              // Extract code from markdown block
              const match = text.match(/```mermaid\s*([\s\S]*?)\s*```/);
              return match ? match[1].trim() : text.trim();
          }
      } catch (e) {
          console.error("Mermaid fix failed:", e);
      }
      return null;
    }
  
    async describeMermaid(code, errorMsg) {
      const url = `${this.apiUrl}/v1beta/models/gemini-3-flash-preview:generateContent`;
      const prompt = `
  The following Mermaid code has a syntax error and could not be fixed after multiple attempts:
  Error: "${errorMsg}"
  
  Code:
  \`\`\`mermaid
  ${code}
  \`\`\`
  
  Please provide a text description of what this diagram was supposed to show. 
  Summarize the content and relationships.
  Do not return mermaid code. Return plain text or markdown text description.
  `;
  
      try {
          const response = await fetch(url, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${this.apiKey}`
              },
              body: JSON.stringify({
                  contents: [{ role: "user", parts: [{ text: prompt }] }],
                  generationConfig: {
                      thinkingConfig: {
                          includeThoughts: false,
                          thinkingBudget: 64
                      }
                  }
              })
          });
          
          if (!response.ok) throw new Error("Describe request failed");
          
          const result = await response.json();
          return result.candidates?.[0]?.content?.parts?.[0]?.text || "无法生成描述";
      } catch (e) {
          console.error("Mermaid describe failed:", e);
          return "Mermaid 渲染失败且无法生成描述。";
      }
    }
  }
