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
    const system = 'You are a precise reranker. Select the single most relevant passage for the question and return strict JSON with keys page, exactQuote, rationale. Keep rationale concise (<=50 words).';
    const user = JSON.stringify({ question, passages });
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 200
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


