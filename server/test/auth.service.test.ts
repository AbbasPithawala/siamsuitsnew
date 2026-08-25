import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env";
import { hashPassword, issueToken, verifyPassword, verifyToken } from "../src/services/auth.service";

describe("auth.service", () => {
  it("hashes and verifies a password round-trip", async () => {
    const hash = await hashPassword("s3cret!");
    expect(hash).not.toBe("s3cret!");
    await expect(verifyPassword("s3cret!", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("issues and verifies a token round-trip", () => {
    const payload = { sub: "user-1", tenantId: "tenant-1", actorType: "user" as const };
    const token = issueToken(payload);
    expect(verifyToken(token)).toMatchObject(payload);
  });

  it("rejects a tampered token", () => {
    const token = issueToken({ sub: "user-1", tenantId: "tenant-1", actorType: "user" });
    const lastChar = token.at(-1);
    const tampered = token.slice(0, -1) + (lastChar === "a" ? "b" : "a");
    expect(() => verifyToken(tampered)).toThrow();
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign({ sub: "user-1", tenantId: "tenant-1", actorType: "user" }, env.JWT_SECRET, {
      expiresIn: -10,
    });
    expect(() => verifyToken(expired)).toThrow();
  });
});
