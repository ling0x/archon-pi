import { config } from './config.js';

export interface OpenClawTask {
  id: string;
  status: string;
  result?: string;
}

/**
 * Send a task to the local OpenClaw daemon gateway.
 */
export async function sendTask(task: string, agentName?: string): Promise<OpenClawTask> {
  const res = await fetch(`${config.openclaw.url}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent: agentName ?? config.openclaw.agent,
      task,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`OpenClaw error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<OpenClawTask>;
}

/**
 * Poll a task by ID until it completes or times out.
 */
export async function pollTask(
  taskId: string,
  timeoutMs = 60_000,
  intervalMs = 2_000
): Promise<OpenClawTask> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${config.openclaw.url}/api/tasks/${taskId}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      const task = await res.json() as OpenClawTask;
      if (task.status === 'complete' || task.status === 'error') return task;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`OpenClaw task ${taskId} timed out after ${timeoutMs}ms`);
}
