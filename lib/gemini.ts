import 'server-only';
// Gemini API configuration (server-only)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL_NAME = 'models/gemini-2.5-flash-lite-preview-06-17';

// Validate API key
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment variables');
}

interface GeminiRequest {
  contents: {
    parts: {
      text: string;
    }[];
  }[];
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
}

export async function callGeminiAPI(prompt: string, maxTokens: number = 1024): Promise<string> {
  try {
    const request: GeminiRequest = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3, // 低めの温度でより決定的な出力
        topK: 20,
        topP: 0.8,
        maxOutputTokens: maxTokens
      }
    };

    const response = await fetch(`${GEMINI_API_URL}/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', errorData);
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data: GeminiResponse = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

// キーワード抽出専用の関数
export async function extractKeywordsFromQuestion(
  question: string, 
  options: string[], 
  correctAnswer: string,
  explanation: string
): Promise<string[]> {
  const prompt = `あなたは金融規制の専門家です。以下の問題文から、教材で検索すべき最も重要なキーワードを1〜2個抽出してください。

問題文:
${question}

選択肢:
${options.join('\n')}

正解: ${correctAnswer}

解説:
${explanation}

要件:
1. 英国金融規制（UKFR）の専門用語を優先
2. 問題の核心となる概念や制度名を選択
3. 一般的すぎる単語は避ける（例: "regulation", "financial"）
4. 略語がある場合は正式名称も含める

回答は以下の形式で、キーワードのみをカンマ区切りで返してください:
keyword1, keyword2`;

  try {
    const response = await callGeminiAPI(prompt, 100);
    
    // レスポンスからキーワードを抽出
    const keywords = response
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .slice(0, 2); // 最大2個まで
    
    return keywords;
  } catch (error) {
    console.error('キーワード抽出エラー:', error);
    // エラー時はフォールバック
    return extractFallbackKeywords(question);
  }
}

// フォールバック用のキーワード抽出（AIが使えない場合）
function extractFallbackKeywords(question: string): string[] {
  // 金融規制に関連する重要な用語のリスト
  const importantTerms = [
    'FCA', 'PRA', 'FSMA', 'MiFID', 'COBS', 'SYSC', 'PRIN', 'TCF',
    'client money', 'client assets', 'conduct risk', 'prudential',
    'approved person', 'senior manager', 'certification regime',
    'regulatory capital', 'threshold conditions', 'Part 4A permission'
  ];
  
  const keywords: string[] = [];
  const lowerQuestion = question.toLowerCase();
  
  // 重要な用語を検索
  for (const term of importantTerms) {
    if (lowerQuestion.includes(term.toLowerCase())) {
      keywords.push(term);
      if (keywords.length >= 2) break;
    }
  }
  
  // キーワードが見つからない場合は、大文字の略語を探す
  if (keywords.length === 0) {
    const acronyms = question.match(/\b[A-Z]{2,}\b/g);
    if (acronyms) {
      keywords.push(...acronyms.slice(0, 2));
    }
  }
  
  return keywords;
}