import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAIClient } from '@/lib/openai';

const RequestSchema = z.object({
  question: z.string().min(3),
  passages: z.array(z.object({
    materialId: z.string(),
    page: z.number().int().min(1),
    quote: z.string().min(1),
    score: z.number()
  })).min(1).max(10),  // Increased to allow more passages for better accuracy
  explanation: z.string().optional(),  // Add optional explanation from the question
  extractedAmounts: z.array(z.string()).optional()  // Add optional extracted amounts
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
    const { question, passages, explanation, extractedAmounts } = parsed.data;
    const openai = getOpenAIClient();
    const system = `You are an expert at matching Japanese financial regulation questions with English educational materials.

TASK: Use Chain-of-Thought reasoning to select the SINGLE most relevant passage.

SCORING CRITERIA (Total: 10 points):
1. Direct Answer Relevance (0-4 points): Does the passage directly answer the question?
2. Numerical Accuracy (0-3 points): Do amounts/numbers match exactly? (e.g., £85,000)
3. Section Relevance (0-3 points): Is this the primary section about the topic?

REASONING PROCESS:
Step 1: Identify the core question (What specific information is being asked?)
Step 2: Extract key elements (amounts, institutions, regulations)
Step 3: Evaluate each passage against the criteria
Step 4: Select the highest-scoring passage with clear justification

IMPORTANT:
- Passages about "FSCS scheme limits" should be prioritized for deposit guarantee questions
- Passages about "financial promotion" are usually NOT about deposit guarantees
- Pay special attention to specific amounts mentioned (£85,000, £150,000, etc.)

Return JSON with:
- page: page number of best match
- exactQuote: first 150 chars of the passage
- score: total score (0-10)
- reasoning: step-by-step reasoning for selection (max 200 words)
- confidence: confidence level (low/medium/high)`;
    
    const user = `Question (Japanese): ${question}
${explanation ? `\nExplanation: ${explanation}` : ''}
${extractedAmounts?.length ? `\nKey amounts mentioned: ${extractedAmounts.join(', ')}` : ''}

Available passages (English):
${passages.map((p, i) => `
Passage ${i+1}:
- Page: ${p.page}
- Relevance Score: ${p.score.toFixed(3)}
- Content: ${p.quote.slice(0, 300)}${p.quote.length > 300 ? '...' : ''}
`).join('\n')}

APPLY THE CHAIN-OF-THOUGHT PROCESS:
1. What is the core question asking about?
2. Which passages contain the specific information needed?
3. Score each passage using the criteria
4. Select and justify your choice

Return the required JSON.`;
    const resp = await openai.chat.completions.create({
      model: 'gpt-5-mini-2025-08-07',  // Using GPT-5 mini for better speed/accuracy balance
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_object' }
    });
    const content = resp.choices[0]?.message?.content || '{}';
    let json: any;
    try { json = JSON.parse(content); } catch { json = {}; }
    return NextResponse.json({ success: true, data: json });
  } catch (err) {
    console.error('rerank error', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: 'Use POST' }, { status: 405 });
}


