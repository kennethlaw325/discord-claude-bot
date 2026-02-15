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
