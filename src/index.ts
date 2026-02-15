import "dotenv/config";
import { appendFileSync } from "node:fs";
import { createBot } from "./bot.js";

// Redirect all console output to a log file for debugging
const logFile = new URL("../debug.log", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const origLog = console.log;
const origError = console.error;
console.log = (...args: unknown[]) => {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}\n`;
  origLog(...args);
  try { appendFileSync(logFile, line); } catch {}
};
console.error = (...args: unknown[]) => {
  const line = `[${new Date().toISOString()}] ERROR: ${args.map(a => a instanceof Error ? a.stack : String(a)).join(" ")}\n`;
  origError(...args);
  try { appendFileSync(logFile, line); } catch {}
};

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
