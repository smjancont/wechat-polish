/**
 * 微信文案润色 — Vercel Serverless Function
 * 接收前端请求，调用通义千问 API 进行文案润色
 */

// 风格对应的 Prompt 配置
const STYLE_PROMPTS = {
  friendly: {
    name: '亲切随和',
    prompt: `请将以下文字润色为"亲切随和"风格。要求：
- 语气温暖友好，像朋友间聊天
- 可以适当使用"呀"、"哦"、"呢"等语气词
- 加入适当的表情符号（如😊、👋等）
- 保持原意不变，自然不生硬
- 适合微信日常聊天场景`,
  },

  formal: {
    name: '正式商务',
    prompt: `请将以下文字润色为"正式商务"风格。要求：
- 语气正式专业，得体大方
- 使用敬语和规范的书面表达
- 结构清晰，逻辑通顺
- 适合职场沟通、客户交流场景
- 不使用表情符号`,
  },

  humorous: {
    name: '幽默风趣',
    prompt: `请将以下文字润色为"幽默风趣"风格。要求：
- 语气轻松幽默，让人会心一笑
- 可以适当加入网络热梗或俏皮话
- 保持原意不变，不要太夸张
- 加入适当的表情包式表达（如😂、🤣等）
- 适合轻松的朋友聊天场景`,
  },

  concise: {
    name: '简洁直接',
    prompt: `请将以下文字润色为"简洁直接"风格。要求：
- 言简意赅，去掉冗余词句
- 一句话能说清绝不用两句
- 直接表达核心意思，不绕弯子
- 逻辑清晰，重点突出
- 适合快速沟通、通知类场景`,
  },
};

export default async function handler(req, res) {
  // CORS 设置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  try {
    const { text, style } = req.body;

    // 参数校验
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: '请提供需要润色的文字' });
    }
    if (text.length > 500) {
      return res.status(400).json({ error: '文字超过 500 字限制' });
    }

    const styleConfig = STYLE_PROMPTS[style] || STYLE_PROMPTS.friendly;

    // 调用通义千问 API（阿里云 DashScope）
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: '服务未配置 API Key，请联系管理员' });
    }

    const systemPrompt = `${styleConfig.prompt}\n\n请只输出润色后的文字，不要加任何解释或前缀。`;

    const apiResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `需要润色的原文：\n${text.trim()}` },
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!apiResponse.ok) {
      const errBody = await apiResponse.text();
      console.error('通义千问 API 错误:', apiResponse.status, errBody);
      return res.status(502).json({ error: 'AI 服务暂时不可用，请稍后再试' });
    }

    const apiData = await apiResponse.json();
    const result = apiData.choices?.[0]?.message?.content?.trim();

    if (!result) {
      return res.status(502).json({ error: 'AI 返回为空，请重试' });
    }

    return res.status(200).json({ result });
  } catch (error) {
    console.error('润色请求异常:', error);
    return res.status(500).json({ error: '服务器异常，请稍后再试' });
  }
}
