# Discord Claude Code Bot 設計文件

日期：2026-02-15

## 概要

一個 Discord bot，透過 spawn `claude` CLI process，等用戶可以喺 Discord thread 入面用齊 Claude Code 所有功能。所有用量計落 Pro Plan，唔使用 Claude API。

## 架構

```
Discord Thread          Bot 伺服器               Claude Code CLI
─────────────          ──────────              ───────────────
用戶訊息      ──────►  Discord.js Bot  ──────►  claude -p --resume <id>
                       (身份驗證)                (每條訊息 spawn 一次)
                       (session 對應表)
用戶收到      ◄──────  格式化 & 拆分   ◄──────  JSON 回應
回應                   (2000 字元上限)
```

## 核心組件

1. **Discord Bot** (Node.js + discord.js) - 監聽訊息，檢查身份
2. **Session 管理器** - 將 Discord thread ID 對應到 Claude Code session ID
3. **CLI 橋接器** - 每條訊息 spawn `claude -p --resume <session-id>`，解析 JSON 輸出
4. **回應格式化器** - 將長回應拆分成 2000 字元以內嘅 Discord 訊息

## Session 管理

1. **開新對話** - 用戶開個新 Discord thread → bot 行 `claude -p "訊息"` → 記低邊個 thread 對應邊個 claude session
2. **繼續對話** - 同一個 thread 再講嘢 → bot 用 `claude -p --resume <sessionId> "訊息"` → claude 記得之前講過咩
3. **工作目錄** - 所有 claude session 都喺指定嘅資料夾入面運行（例如 `~/projects`）

Bot 重啟嘅話對應關係會消失，開個新 thread 就搞掂。

## Discord 訊息處理

1. **收到訊息** - 用戶 tag bot 或者喺 thread 入面打字
2. **檢查身份** - 對比用戶嘅 Discord ID 同白名單
3. **送去 Claude** - 將訊息交俾 CLI 橋接器 → spawn process → 等回應
4. **回覆用戶** - 回應拆分後送返 Discord thread

### 觸發方式

- 喺 thread 入面直接打字 → bot 自動回應
- 喺普通 channel @bot + 訊息 → bot 自動開個新 thread 回應

### 長回應處理

Discord 每條訊息上限 2000 字。回應超長會按段落拆開，code block 盡量保持完整。

## 安全

- 白名單得一個 Discord ID，其他人發訊息直接無視
- Discord Bot Token 同 Discord ID 放喺 `.env` 檔案，唔會 commit 入 git
- Claude Code 本身有 sandbox 同權限控制

## 錯誤處理

- Claude process 超過 5 分鐘冇回應 → 自動 kill，回覆「超時」
- Claude process crash → 回覆「出錯」
- 訊息太長 → 提示用戶拆短啲

## 技術棧

- TypeScript + Node.js
- discord.js v14
- child_process.spawn
- in-memory Map（session 對應）

## 檔案結構

```
discord-claude-bot/
├── src/
│   ├── index.ts          # 入口，啟動 Discord bot
│   ├── bot.ts            # Discord 事件處理
│   ├── session.ts        # Session 管理器
│   ├── cli-bridge.ts     # CLI 橋接器
│   └── formatter.ts      # 回應格式化器
├── .env                  # Bot Token + 白名單 ID
├── .gitignore
├── package.json
└── tsconfig.json
```
