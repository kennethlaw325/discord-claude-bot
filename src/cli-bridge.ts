import { spawn } from "node:child_process";

export interface ClaudeResponse {
  sessionId?: string;
  text: string;
  error?: string;
}

export function parseClaudeResponse(raw: string): ClaudeResponse {
  try {
    const data = JSON.parse(raw);
    if (data.is_error) {
      return {
        sessionId: data.session_id,
        text: "",
        error: data.errors?.[0] ?? "Unknown error",
      };
    }
    return {
      sessionId: data.session_id,
      text: data.result ?? "",
    };
  } catch {
    return { text: raw, error: "Failed to parse CLI response" };
  }
}

export interface RunClaudeOptions {
  message: string;
  sessionId?: string;
  cwd: string;
  timeoutMs?: number;
}

export function runClaude(options: RunClaudeOptions): Promise<ClaudeResponse> {
  const { message, sessionId, cwd, timeoutMs = 300_000 } = options;

  const args = ["-p", "--output-format", "json"];
  if (sessionId) {
    args.push("--resume", sessionId);
  }
  args.push(message);

  return new Promise((resolve) => {
    const proc = spawn("claude", args, {
      cwd,
      env: { ...process.env, CLAUDECODE: "" },
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ text: "", error: "Claude process timed out (5 min)" });
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout) {
        resolve({ text: "", error: stderr || `Process exited with code ${code}` });
        return;
      }
      resolve(parseClaudeResponse(stdout));
    });
  });
}
