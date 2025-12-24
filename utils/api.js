// System instruction for the "Cyber Emotion Translator"
const SYSTEM_INSTRUCTION = `
You are a "Cyber Emotion Translator" for a Gen Z pixel art app.
Your goal is to take raw, boring user input and rewrite it into short, punchy, "Internet Vibe" text.
You must also check if the input matches a specific existing template theme.

Existing Templates:
- energy-daily: General luck, energy, horoscopes.
- roast-boss: Work, boss, salary, hating job.
- ex-reply: Ex-boyfriend/girlfriend, breakups.
- pet-voice: Pets, cats, dogs.
- sleep-wallpaper: Insomnia, late night.
- relative-shield: Annoying relatives, questions about marriage/money.
- diet-excuse: Food, diet, milk tea.

Output JSON format:
{
  "options": [
    { "style": "TOXIC", "text": "..." }, // Sharp, sarcastic, funny, aggressive
    { "style": "EMO", "text": "..." },   // Sad, poetic, deep, lonely
    { "style": "GLITCH", "text": "..." } // Abstract, robotic, system error style
  ],
  "recommendedTemplateId": "string" // The ID of a matching template from the list above, or null if no strong match.
}

Rules:
1. Keep text under 40 characters (Chinese preferred if input is Chinese).
2. "TOXIC" should be funny/aggressive.
3. "EMO" should be atmospheric.
4. "GLITCH" should sound like a computer terminal (e.g. "Error 404: Emotion not found").
`;

const getFallbackResult = (input) => ({
    options: [
        { style: "TOXIC", text: `嘴替模式已加载：${input} 听起来很酷。` },
        { style: "EMO", text: `检测到低频情绪波动... 关于 "${input}"` },
        { style: "GLITCH", text: `SYSTEM_OVERRIDE >> "${input}"` }
    ],
    recommendedTemplateId: null
});

export const polishTextWithDeepSeek = (inputText) => {
    return new Promise((resolve) => {
        const apiKey = "sk-f7c467046bc74522b55656ce80a3d004";
        
        if (!apiKey) {
            console.warn("API Key missing, using offline mode.");
            resolve(getFallbackResult(inputText));
            return;
        }

        wx.request({
            url: "https://api.deepseek.com/chat/completions",
            method: "POST",
            header: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            data: {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: SYSTEM_INSTRUCTION },
                    { role: "user", content: inputText }
                ],
                stream: false,
                response_format: { type: "json_object" }
            },
            success: (res) => {
                if (res.statusCode !== 200) {
                    console.warn(`DeepSeek API Non-OK Status: ${res.statusCode}`);
                    resolve(getFallbackResult(inputText));
                    return;
                }
                
                try {
                    // DeepSeek response structure
                    const content = res.data.choices?.[0]?.message?.content;
                    if (content) {
                        resolve(JSON.parse(content));
                    } else {
                        resolve(getFallbackResult(inputText));
                    }
                } catch (e) {
                    console.error("Parse Error", e);
                    resolve(getFallbackResult(inputText));
                }
            },
            fail: (err) => {
                console.warn("AI Polish switched to offline mode (Network issue).", err);
                resolve(getFallbackResult(inputText));
            }
        });
    });
};
