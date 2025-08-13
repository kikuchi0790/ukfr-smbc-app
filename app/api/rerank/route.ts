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
  })).min(1).max(5)
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
    const { question, passages } = parsed.data;
    const openai = getOpenAIClient();
    const system = `You are an expert at matching Japanese financial regulation questions with English educational materials.

TASK: Select the SINGLE most relevant passage that answers the given Japanese question.

IMPORTANT:
- The question is in Japanese but the passages are in English
- Focus on conceptual matches, not literal translations
- Consider financial regulation terminology carefully (FCA, PRA, FSMA, COBS, etc.)
- Return strict JSON with keys: page (number), exactQuote (first 100 chars of best match), rationale (why this passage answers the question, max 50 words)

EXAMPLE:
Question: "FCAの主な目的は何ですか？"
Best match would be a passage explaining "The FCA's objectives are..." or "The Financial Conduct Authority aims to..."`;
    
    const user = `Question (Japanese): ${question}

Available passages (English):
${passages.map((p, i) => `${i+1}. [Page ${p.page}] ${p.quote.slice(0, 200)}...`).join('\n\n')}

Select the best passage number and return the required JSON.`;
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Slight temperature for better understanding
      max_tokens: 300 // Increased for bilingual processing
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


