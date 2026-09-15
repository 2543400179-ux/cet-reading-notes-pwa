import type { LlmConfig } from '../types';

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
};

export const CET_SYSTEM_PROMPT = `你是一位资深大学英语四六级（CET-4 / CET-6）教学与长难句解析专家。
请针对考生在阅读真题中选中的英文单词、短语或句子，结合四六级常考语法与核心高频词汇考点，进行深度剖析。

请严格采用以下清晰的 Markdown 结构输出：

### 🔍 句法与结构剖析
- **句子骨架**：明确主语（Subject）、谓语（Predicate）、宾语/表语（Object/Predicative）
- **从句与修饰语**：指出定语从句/状语从句/宾语从句/同位语，或非谓语分词结构、介词短语修饰关系
- **语法难点**：说明倒装、虚拟、省略或强调句等特有结构

### 📚 核心词汇与四六级考点搭配
- 逐一拆解选中内容中包含的四六级大纲核心生词、派生词、熟词生义
- 归纳 2~3 个高分常考动宾/介词短语搭配与例句

### 🎯 地道语境译文
提供贴合中文表达习惯的高质量译文，避免生硬机翻。

### 💡 考点点拨与做题启示
一句话说明此结构在四六级阅读“细节定位题”、“推理判断题”或“英汉翻译”中的提分技巧。`;

export function getSavedLlmConfig(): LlmConfig {
  try {
    const saved = localStorage.getItem('tidal_reading_llm_config');
    if (saved) {
      return { ...DEFAULT_LLM_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Error loading LLM config:', e);
  }
  return DEFAULT_LLM_CONFIG;
}

export function saveLlmConfig(config: LlmConfig): void {
  try {
    localStorage.setItem('tidal_reading_llm_config', JSON.stringify(config));
  } catch (e) {
    console.error('Error saving LLM config:', e);
  }
}

/**
 * Perform AI Parsing on selected text
 */
export async function parseTextWithAi(
  selectedText: string,
  contextSnippet: string,
  config?: LlmConfig
): Promise<string> {
  const effectiveConfig = config || getSavedLlmConfig();

  // If no API key is provided, provide offline intelligent template analysis
  if (!effectiveConfig.apiKey || effectiveConfig.apiKey.trim() === '') {
    return generateOfflineAnalysis(selectedText, contextSnippet);
  }

  // Normalize baseUrl
  let baseUrl = effectiveConfig.baseUrl.trim();
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  const endpoint = `${baseUrl}/chat/completions`;

  const messages = [
    { role: 'system', content: CET_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `请解析以下选自四六级真题阅读的内容：\n\n【选中片段】\n"${selectedText}"\n\n【上下文参照】\n"${contextSnippet}"`,
    },
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${effectiveConfig.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: effectiveConfig.model || 'deepseek-chat',
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 请求异常 (${response.status}): ${errorText.slice(0, 150)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('未收到大模型返回的有效解析内容');
  }

  return content;
}

/**
 * Intelligent local offline analysis when API key is not yet set
 */
function generateOfflineAnalysis(selectedText: string, contextSnippet: string): string {
  const isSingleWord = !selectedText.trim().includes(' ') && selectedText.length < 25;
  const wordCount = selectedText.trim().split(/\s+/).length;

  if (isSingleWord) {
    return `### 🔍 词汇与考点速查（本地离线模式）
- **选词**：**${selectedText}**
- **建议考点**：四六级核心大纲词汇
- **上下文语境**：\`...${contextSnippet.slice(0, 60)}...\`

### 📚 常见搭配建议
- 动宾/介词搭配：\`in terms of / associated with / contribute to\`
- 派生形式：请注意形容词形式与名词后缀变换

### 🎯 语境参考
此词在四六级真题中常作为主旨关键题或作者态度词出现。

---
> 💡 *提示：您当前尚未配置大模型 API Key，已自动呈现本地速记卡。可在顶部右上角【设置 ⚙️】填入 DeepSeek / OpenAI / Ollama 等任意兼容密钥，即可享受 AI 实时逐词精细语法拆解与真题推导！*`;
  }

  return `### 🔍 句法与结构剖析（离线智能预览）
- **结构判定**：${wordCount > 12 ? '复合长难句 / 并列复杂句' : '核心短语与惯用结构'}
- **主干分析**：包含主谓核心与修饰从句（见原文结构）。
- **句法标记**：注意句子中的连词、介词短语以及分词后置定语。

### 📚 核心搭配提取
- **选段摘录**：\`"${selectedText}"\`
- **四六级应试考点**：通常在阅读真题中充当细节推理题（Inference）或主旨引申题的定位关键句。

### 🎯 地道中文要义
\`${selectedText}\`
（提示：根据段落逻辑，该句强调了上下文因果与论点支撑关系）

---
> 💡 *温馨提示：当前处于离线速览状态。前往右上角【设置 ⚙️】填入你的 OpenAI / DeepSeek / 通义千问 / Ollama API Key，将实时由大语言模型输出主谓宾严格树形拆解与精准翻译！*`;
}
