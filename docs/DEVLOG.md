# Development Log

## 2026-02-15: Project Build & Debugging

### Overview

Built a Discord bot that bridges to Claude Code CLI, allowing full Claude Code access via Discord threads. All usage counts toward Pro Plan (no API credits needed).

### Build Process

**Design Phase**
- Brainstormed architecture: Discord.js bot spawns `claude -p` per message
- Key decisions: thread-based conversations, user whitelist auth, `--resume` for session continuity
- Design doc: `docs/plans/2026-02-15-discord-claude-bot-design.md`

**Implementation (7 Tasks)**

| Task | Component | Approach |
|------|-----------|----------|
| 1 | Project scaffolding | npm init, TypeScript, vitest, discord.js |
| 2 | Response formatter | TDD - 5 tests for message splitting |
| 3 | CLI bridge | TDD - 4 tests for JSON parsing |
| 4 | Session manager | TDD - 4 tests for Map-based sessions |
| 5 | Discord bot handler | Event handling, auth, threading |
| 6 | Entry point | .env config loading |
| 7 | Verification | tsc + vitest, 13/13 pass |

Tasks 2, 3, 4 were executed in parallel using agent teams (3 independent subagents).

---

### Debugging: Windows Spawn Crash (Exit Code 3221225794)

**Symptom:** Bot received Discord message, spawned `claude` CLI, but process immediately crashed with exit code `3221225794`.

**Exit code analysis:** `3221225794` = `0xC0000142` = Windows `STATUS_DLL_INIT_FAILED`

#### Attempt 1: Set CLAUDECODE to empty string

```typescript
// Hypothesis: Claude Code blocks nested sessions via CLAUDECODE env var
env: { ...process.env, CLAUDECODE: "" }
```
**Result:** Same crash. Empty string may still be truthy in Claude's check, or wasn't the root cause.

#### Attempt 2: Filter CLAUDECODE from env

```typescript
// Hypothesis: Need to completely remove the key, not just empty it
env: Object.fromEntries(
  Object.entries(process.env).filter(([k]) => k !== "CLAUDECODE")
)
```
**Result:** Same crash. The filtering itself was the problem.

#### Attempt 3: Pipe message via stdin

```typescript
// Hypothesis: Discord mention chars (<, >, &) break Windows cmd
proc.stdin.write(message);
proc.stdin.end();
```
**Result:** Same crash (still had env filtering).

#### Attempt 4: Remove env option entirely

```typescript
// Hypothesis: Object.fromEntries() breaks Windows process.env
const proc = spawn("claude", args, { cwd, shell: true });
// Inherit parent env directly, no modification
```
**Result:** SUCCESS.

#### Root Cause

On Windows, `process.env` is a **case-insensitive Proxy** object. `PATH` and `Path` refer to the same variable. When converted via `Object.fromEntries(Object.entries(process.env))`, this special behavior is lost:

- The result is a plain JS object (case-sensitive)
- Duplicate keys with different casing can collide or be lost
- Critical Windows system variables (`PATH`, `SystemRoot`, `TEMP`) may become corrupted
- This causes `STATUS_DLL_INIT_FAILED` when the spawned process can't find required DLLs

**Lesson:** Never convert `process.env` to a plain object on Windows. If you need to modify env for a child process, use targeted approaches like `delete` on a spread copy, or better yet, inherit the parent env and only override what's needed.

---

### Debugging: Discord Thread Duplication

**Symptom:** `DiscordAPIError[160004]: A thread has already been created for this message`

**Cause:** Retrying the same Discord message after a failed bot response tried to create a second thread on the same message. Discord only allows one thread per message.

**Fix:** Wrapped `message.startThread()` in try-catch, silently skip if thread already exists.

---

### Architecture

```
Discord Thread          Bot Server               Claude Code CLI
─────────────          ──────────              ───────────────
User message  ──────►  Discord.js Bot  ──────►  claude -p --resume <id>
                       (auth check)             (stdin pipe for message)
                       (session map)
User sees     ◄──────  Format & split  ◄──────  JSON response
response               (2000 char limit)
```

### Tech Stack

- TypeScript + Node.js
- discord.js v14
- vitest (13 tests)
- child_process.spawn with stdin pipe
- In-memory Map for session tracking
