import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  client = new OpenAI({ apiKey });
  return client;
}

export async function embedTexts(texts: string[], model: 'text-embedding-3-small' | 'text-embedding-3-large' = 'text-embedding-3-small'): Promise<number[][]> {
  const openai = getOpenAIClient();
  const resp = await openai.embeddings.create({
    model,
    input: texts,
  });
  return resp.data.map(d => d.embedding as unknown as number[]);
}

export async function embedText(text: string, model: 'text-embedding-3-small' | 'text-embedding-3-large' = 'text-embedding-3-small'): Promise<number[]> {
  const [emb] = await embedTexts([text], model);
  return emb;
}


