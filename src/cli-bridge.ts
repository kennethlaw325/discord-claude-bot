import { spawn } from "node:child_process";
import { join } from "node:path";

// Resolve claude CLI entry point directly to bypass cmd.exe
// This avoids Windows codepage issues with CJK characters
const CLAUDE_CLI = join(
  process.env.APPDATA || "",
  "npm/node_modules/@anthropic-ai/claude-code/cli.js",
);

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
  // Message is piped via stdin to avoid Windows shell escaping issues
  // with special chars like <, >, & from Discord mentions

  return new Promise((resolve) => {
    // Spawn node directly with claude's cli.js, bypassing cmd.exe entirely
    // This fixes UTF-8/CJK encoding issues on Windows
    const proc = spawn(process.execPath, [CLAUDE_CLI, ...args], { cwd });

    proc.stdin.write(message, "utf8");
    proc.stdin.end();

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

    proc.on("error", (err) => {
      clearTimeout(timer);
      console.error(`[CLI] spawn error:`, err);
      resolve({ text: "", error: `Spawn error: ${err.message}` });
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      console.log(`[CLI] exit code=${code} stdout=${stdout.length}bytes stderr=${stderr.length}bytes`);
      if (stderr) console.log(`[CLI] stderr: ${stderr.slice(0, 500)}`);
      if (code !== 0 && !stdout) {
        resolve({ text: "", error: stderr || `Process exited with code ${code}` });
        return;
      }
      resolve(parseClaudeResponse(stdout));
    });
  });
}
