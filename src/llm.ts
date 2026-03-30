import ollama from 'ollama';
import { config } from './config.js';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Stream a chat response from Ollama, yielding token chunks.
 */
export async function* streamChat(
  messages: Message[],
  model?: string
): AsyncGenerator<string> {
  const stream = await ollama.chat({
    model: model ?? config.ollama.model,
    messages,
    stream: true,
    options: { num_ctx: 8192 },
  });

  for await (const chunk of stream) {
    const token = chunk.message?.content;
    if (token) yield token;
  }
}

/**
 * One-shot (non-streaming) chat call — returns full response string.
 */
export async function chat(
  messages: Message[],
  model?: string
): Promise<string> {
  const res = await ollama.chat({
    model: model ?? config.ollama.model,
    messages,
    stream: false,
  });
  return res.message.content;
}

/**
 * List all locally available Ollama models.
 */
export async function listModels(): Promise<string[]> {
  const res = await ollama.list();
  return res.models.map((m) => m.name);
}
