import { describe, expect, it } from "vitest";
import authReducer, { clearToken, setToken } from "./authSlice";

describe("authSlice reducer", () => {
  it("starts logged out", () => {
    expect(authReducer(undefined, { type: "@@INIT" })).toEqual({ token: null });
  });

  it("setToken stores the token", () => {
    const state = authReducer(undefined, setToken("abc123"));
    expect(state.token).toBe("abc123");
  });

  it("clearToken resets to logged out", () => {
    const loggedIn = authReducer(undefined, setToken("abc123"));
    const state = authReducer(loggedIn, clearToken());
    expect(state.token).toBeNull();
  });
});
