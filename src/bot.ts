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
    try {
      if (message.author.bot) return;

      console.log(`[MSG] from=${message.author.id} content="${message.content.slice(0, 50)}" channel=${message.channel.type}`);

      if (message.author.id !== config.allowedUserId) {
        console.log(`[SKIP] user not in allowlist`);
        return;
      }

      // Case 1: Message in a thread the bot is participating in
      if (message.channel.isThread()) {
        console.log(`[THREAD] handling thread message`);
        await handleThreadMessage(message, message.channel, config, sessions);
        return;
      }

      // Case 2: Message mentions the bot in a regular channel
      const mentioned = client.user && message.mentions.has(client.user);
      console.log(`[MENTION] bot mentioned: ${mentioned}`);

      if (client.user && mentioned) {
        const content = message.content
          .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
          .trim();
        if (!content) return;

        console.log(`[NEW THREAD] creating thread for: "${content.slice(0, 50)}"`);
        let thread: ThreadChannel;
        try {
          thread = await message.startThread({ name: content.slice(0, 100) });
        } catch {
          // Thread may already exist for this message
          console.log(`[SKIP] could not create thread, may already exist`);
          return;
        }
        await handleThreadMessage(
          { content } as Message,
          thread,
          config,
          sessions,
        );
      }
    } catch (err) {
      console.error(`[ERROR]`, err);
    }
  });

  return client;
}

async function handleThreadMessage(
  message: Message | { content: string },
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
