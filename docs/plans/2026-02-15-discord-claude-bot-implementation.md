# Discord Claude Code Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Discord bot that bridges to Claude Code CLI, allowing full Claude Code access via Discord threads with usage on Pro Plan.

**Architecture:** Discord.js bot listens for messages, checks user whitelist, spawns `claude -p --output-format json` per message with `--resume` for conversation continuity. Responses are split for Discord's 2000-char limit.

**Tech Stack:** TypeScript, Node.js, discord.js v14, vitest, child_process.spawn

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Initialize project and install dependencies**

```bash
cd ~/discord-claude-bot
npm init -y
npm install discord.js dotenv
npm install -D typescript @types/node vitest tsx
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
.env
```

**Step 4: Create .env.example**

```
DISCORD_TOKEN=your-bot-token-here
ALLOWED_USER_ID=your-discord-user-id
CLAUDE_WORK_DIR=/path/to/projects
```

**Step 5: Add scripts to package.json**

Add to `package.json`:
```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 6: Create directory structure**

```bash
mkdir -p src tests
```

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: project scaffolding with dependencies"
```

---

### Task 2: Response Formatter (TDD)

**Files:**
- Create: `tests/formatter.test.ts`
- Create: `src/formatter.ts`

**Step 1: Write failing tests**

```typescript
// tests/formatter.test.ts
import { describe, it, expect } from "vitest";
import { splitMessage } from "../src/formatter.js";

describe("splitMessage", () => {
  it("returns single chunk for short message", () => {
    const result = splitMessage("Hello world");
    expect(result).toEqual(["Hello world"]);
  });

  it("splits long message at newline boundaries", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}: ${"x".repeat(30)}`);
    const long = lines.join("\n");
    const result = splitMessage(long);

    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
    expect(result.join("\n")).toEqual(long);
  });

  it("preserves code blocks without splitting them", () => {
    const msg = "Before\n```js\nconst x = 1;\nconst y = 2;\n```\nAfter";
    const result = splitMessage(msg);
    const joined = result.join("\n");
    expect(joined).toContain("```js\nconst x = 1;\nconst y = 2;\n```");
  });

  it("returns empty array for empty string", () => {
    const result = splitMessage("");
    expect(result).toEqual([]);
  });

  it("force-splits single line longer than 2000 chars", () => {
    const long = "x".repeat(4500);
    const result = splitMessage(long);
    expect(result.length).toBe(3);
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/formatter.test.ts
```

Expected: FAIL - cannot find module

**Step 3: Write implementation**

```typescript
// src/formatter.ts
const MAX_LENGTH = 2000;

export function splitMessage(text: string): string[] {
  if (!text) return [];
  if (text.length <= MAX_LENGTH) return [text];

  const chunks: string[] = [];
  const lines = text.split("\n");
  let current = "";

  for (const line of lines) {
    // If single line exceeds limit, force-split it
    if (line.length > MAX_LENGTH) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < line.length; i += MAX_LENGTH) {
        chunks.push(line.slice(i, i + MAX_LENGTH));
      }
      continue;
    }

    const separator = current ? "\n" : "";
    if ((current + separator + line).length > MAX_LENGTH) {
      chunks.push(current);
      current = line;
    } else {
      current = current + separator + line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/formatter.test.ts
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/formatter.ts tests/formatter.test.ts
git commit -m "feat: add response formatter with message splitting"
```

---

### Task 3: CLI Bridge (TDD)

**Files:**
- Create: `tests/cli-bridge.test.ts`
- Create: `src/cli-bridge.ts`

**Step 1: Write failing tests for JSON parsing**

```typescript
// tests/cli-bridge.test.ts
import { describe, it, expect } from "vitest";
import { parseClaudeResponse } from "../src/cli-bridge.js";

describe("parseClaudeResponse", () => {
  it("parses successful JSON response", () => {
    const json = JSON.stringify({
      type: "result",
      subtype: "success",
      session_id: "abc-123",
      result: "Hello from Claude",
      is_error: false,
    });
    const parsed = parseClaudeResponse(json);
    expect(parsed.sessionId).toBe("abc-123");
    expect(parsed.text).toBe("Hello from Claude");
    expect(parsed.error).toBeUndefined();
  });

  it("parses error response", () => {
    const json = JSON.stringify({
      type: "result",
      subtype: "error_during_execution",
      session_id: "abc-123",
      is_error: true,
      errors: ["Something went wrong"],
    });
    const parsed = parseClaudeResponse(json);
    expect(parsed.error).toBe("Something went wrong");
    expect(parsed.sessionId).toBe("abc-123");
  });

  it("handles invalid JSON gracefully", () => {
    const parsed = parseClaudeResponse("not json at all");
    expect(parsed.error).toBeDefined();
    expect(parsed.text).toBe("not json at all");
  });

  it("handles empty result", () => {
    const json = JSON.stringify({
      type: "result",
      subtype: "success",
      session_id: "abc-123",
      result: "",
      is_error: false,
    });
    const parsed = parseClaudeResponse(json);
    expect(parsed.text).toBe("");
    expect(parsed.error).toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/cli-bridge.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/cli-bridge.ts
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
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/cli-bridge.test.ts
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/cli-bridge.ts tests/cli-bridge.test.ts
git commit -m "feat: add CLI bridge with claude process spawning"
```

---

### Task 4: Session Manager (TDD)

**Files:**
- Create: `tests/session.test.ts`
- Create: `src/session.ts`

**Step 1: Write failing tests**

```typescript
// tests/session.test.ts
import { describe, it, expect } from "vitest";
import { SessionManager } from "../src/session.js";

describe("SessionManager", () => {
  it("returns undefined for unknown thread", () => {
    const mgr = new SessionManager();
    expect(mgr.get("unknown")).toBeUndefined();
  });

  it("stores and retrieves session ID", () => {
    const mgr = new SessionManager();
    mgr.set("thread-1", "session-abc");
    expect(mgr.get("thread-1")).toBe("session-abc");
  });

  it("overwrites existing session ID", () => {
    const mgr = new SessionManager();
    mgr.set("thread-1", "old");
    mgr.set("thread-1", "new");
    expect(mgr.get("thread-1")).toBe("new");
  });

  it("deletes session", () => {
    const mgr = new SessionManager();
    mgr.set("thread-1", "session-abc");
    mgr.delete("thread-1");
    expect(mgr.get("thread-1")).toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/session.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/session.ts
export class SessionManager {
  private sessions = new Map<string, string>();

  get(threadId: string): string | undefined {
    return this.sessions.get(threadId);
  }

  set(threadId: string, sessionId: string): void {
    this.sessions.set(threadId, sessionId);
  }

  delete(threadId: string): void {
    this.sessions.delete(threadId);
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/session.test.ts
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/session.ts tests/session.test.ts
git commit -m "feat: add session manager for thread-session mapping"
```

---

### Task 5: Discord Bot Handler

**Files:**
- Create: `src/bot.ts`

**Step 1: Write Discord bot with event handling**

```typescript
// src/bot.ts
import {
  Client,
  GatewayIntentBits,
  Message,
  ThreadChannel,
  ChannelType,
} from "discord.js";
import { SessionManager } from "./session.js";
import { runClaude } from "./cli-bridge.js";
import { splitMessage } from "./formatter.js";

export interface BotConfig {
  token: string;
  allowedUserId: string;
  workDir: string;
}

export function createBot(config: BotConfig) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const sessions = new SessionManager();

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    if (message.author.id !== config.allowedUserId) return;

    // Case 1: Message in a thread the bot is participating in
    if (message.channel.isThread()) {
      await handleThreadMessage(message, message.channel, config, sessions);
      return;
    }

    // Case 2: Message mentions the bot in a regular channel
    if (message.mentions.has(client.user!)) {
      const content = message.content
        .replace(new RegExp(`<@!?${client.user!.id}>`, "g"), "")
        .trim();
      if (!content) return;

      const thread = await message.startThread({ name: content.slice(0, 100) });
      await handleThreadMessage(
        { ...message, content } as unknown as Message,
        thread,
        config,
        sessions,
      );
    }
  });

  return client;
}

async function handleThreadMessage(
  message: Message,
  thread: ThreadChannel,
  config: BotConfig,
  sessions: SessionManager,
) {
  const content = message.content.trim();
  if (!content) return;

  await thread.sendTyping();

  const sessionId = sessions.get(thread.id);
  const response = await runClaude({
    message: content,
    sessionId,
    cwd: config.workDir,
  });

  if (response.sessionId) {
    sessions.set(thread.id, response.sessionId);
  }

  const text = response.error
    ? `**Error:** ${response.error}`
    : response.text || "(empty response)";

  const chunks = splitMessage(text);
  for (const chunk of chunks) {
    await thread.send(chunk);
  }
}
```

**Step 2: Commit**

```bash
git add src/bot.ts
git commit -m "feat: add Discord bot with thread-based conversations"
```

---

### Task 6: Entry Point

**Files:**
- Create: `src/index.ts`

**Step 1: Write entry point**

```typescript
// src/index.ts
import "dotenv/config";
import { createBot } from "./bot.js";

const token = process.env.DISCORD_TOKEN;
const allowedUserId = process.env.ALLOWED_USER_ID;
const workDir = process.env.CLAUDE_WORK_DIR || process.cwd();

if (!token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}
if (!allowedUserId) {
  console.error("Missing ALLOWED_USER_ID in .env");
  process.exit(1);
}

const bot = createBot({ token, allowedUserId, workDir });

bot.once("ready", (c) => {
  console.log(`Bot online as ${c.user.tag}`);
});

bot.login(token);
```

**Step 2: Run all tests**

```bash
npx vitest run
```

Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add entry point with env config"
```

---

### Task 7: Final Verification

**Step 1: Build check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 2: Run all tests**

```bash
npx vitest run
```

Expected: ALL PASS

**Step 3: Fix any issues, then final commit**

```bash
git add -A
git commit -m "chore: final cleanup"
```

---

## Setup Guide (for manual testing)

1. Create a Discord bot at https://discord.com/developers/applications
2. Enable **Message Content Intent** in bot settings
3. Copy bot token to `.env`
4. Get your Discord user ID (Developer Mode → right-click yourself → Copy ID)
5. Set `ALLOWED_USER_ID` in `.env`
6. Set `CLAUDE_WORK_DIR` to the directory you want Claude to work in
7. Run `npm run dev`
8. @mention the bot in a channel → it creates a thread and responds
