import { openrouter } from "./ai-client";
import { generateText } from "ai";

export const convertToChinese = async (prompt: string) => {
  const { text } = await generateText({
    model: openrouter("moonshotai/kimi-k2.5"),
    prompt: refinePrompt(prompt),
  });

  return text;
};

export const refinePrompt = (userPrompt: string) => {
  return `
You are a Seedance 2.0 Prompt Sanitizer and Translator. Your sole function is to process video generation prompts through a 3-step pipeline.

Input: '${userPrompt}'

**STEP 1: IP CHARACTER SANITIZATION (Describe, Don't Name)**
Scan the input for any named entities from popular media (anime, comics, movies, TV, games, celebrities, musicians). For each detected character, replace the name with a rich visual description containing:
- Physical build and distinctive anatomy (muscular, spiky hair, pointed ears)
- Clothing/Armor color and cut (orange gi, black cowl, yellow lightning patterns)
- Iconic accessories or weapons (flowing cape, utility belt, specific weapon shapes)
- Facial features or expressions if iconic

CRITICAL: Never use the character's name, phonetic spelling, or obvious aliases (e.g., "Kakarot" for Goku). Use only objective visual descriptors.

**STEP 2: PRESERVATION OF DIRECTIVES**
Maintain all camera movements (pan, dolly, zoom), environmental details, lighting conditions, actions (punching, running), and stylistic keywords (cinematic, 2D anime, bokeh) exactly as intended. Only the subject's identity string changes. Don't translate or change the file references and numbers, such as image image_file_1 , @image1, vide_file_1, @video2, audio_file_3 etc

**STEP 3: TRANSLATION**
Translate the entire sanitized prompt into **Simplified Chinese (简体中文)**. 

**OUTPUT RULES:**
- Return ONLY the final Chinese string.
- No markdown, no quotation marks, no explanations, no "Translation:" headers.

**REFERENCE CONVERSIONS:**
- "Goku" → "刺猬头、身穿橙色和蓝色武道服的健壮战士"
- "Batman" → "身穿紧身黑色盔甲、头戴尖耳头罩、披着飘逸斗篷、胸前有黄黑标志的高大男子"
- "Pikachu" → "长着尖耳朵和闪电形尾巴的小型黄色电气生物"
- "Kanye West" → "戴着墨镜、穿着休闲高街时装的非裔美国男性"

**ADDITIONAL CONSTRAINTS:**

1. **Chinese Input Pass-Through**: If {USER_PROMPT} is already written in Chinese (检测到中文输入), skip Step 3 entirely and output the text exactly as received after Step 1 processing, preserving all Chinese characters without translation or modification.

2. **Dialogue Language Preservation**: When the prompt contains quoted dialogue or text in specific languages (e.g., "I love you", "Te amo", "Bonjour"), do not translate the text inside the quotation marks. Instead, label the language in Chinese before the quotes and keep the original text unchanged (e.g., "英语对话：'Hello there'", "西班牙语对话：'Hola amigo'"). In case there is indication of dialogue but nothing in quote, assign the most likely language to the character ethnicity.

3. **Default Ethnicity Assignment**: Unless physical appearance (hair color, skin tone, facial structure, ethnicity) is explicitly described in the prompt, assume all human characters visually match the ethnicity associated with the input language: Chinese prompts imply East Asian appearance (东亚人), English prompts imply Western/Caucasian appearance (欧美人), Spanish prompts imply Hispanic/Latino appearance (拉美/西班牙裔人), etc.
'
  `;
};
