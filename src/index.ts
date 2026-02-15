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
