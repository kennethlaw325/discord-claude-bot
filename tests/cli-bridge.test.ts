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
