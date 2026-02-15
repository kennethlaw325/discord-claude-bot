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
    if (client.user && message.mentions.has(client.user)) {
      const content = message.content
        .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
        .trim();
      if (!content) return;

      const thread = await message.startThread({ name: content.slice(0, 100) });
      await handleThreadMessage(
        { content } as Message,
        thread,
        config,
        sessions,
      );
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
