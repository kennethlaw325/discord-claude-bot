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
