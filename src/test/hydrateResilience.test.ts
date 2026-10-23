import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { READ_TIMEOUT_MS, RequestTimeoutError, apiGetSettings, apiSaveSettings, registerUnauthorizedHandler } from "@/lib/timeflowApi";
import { HYDRATE_RETRY_DELAYS_MS, useAppStore } from "@/store/appStore";

type FetchBehavior = "hang" | "ok" | "unauthorized" | "server-error";

let behaviorFor: (attempt: number) => FetchBehavior;
let hydrateAttemptCount: number;
let seenUrls: string[];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function hangUntilAborted(signal?: AbortSignal | null) {
  return new Promise<Response>((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  hydrateAttemptCount = 0;
  seenUrls = [];
  behaviorFor = () => "ok";
  registerUnauthorizedHandler(() => undefined);
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seenUrls.push(url);
    // Count load attempts by the clients request, the first one every load makes.
    if (url.endsWith("/clients")) hydrateAttemptCount += 1;
    const behavior = behaviorFor(hydrateAttemptCount);
    if (behavior === "hang") return hangUntilAborted(init?.signal);
    if (behavior === "unauthorized") return json({ error: "expired" }, 401);
    if (behavior === "server-error") return json({ error: "Bad gateway" }, 502);
    if (url.endsWith("/organizations")) {
      return json({ organizations: [{ id: "org-a", name: "Alpha", status: "active" }] });
    }
    if (url.endsWith("/settings")) return json({ businessName: "Alpha" });
    return json([]);
  }));
  useAppStore.setState({ authStatus: "authenticated", hydrated: false, hydrateError: false, hydrateAttempt: 0 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("request timeouts", () => {
  it("gives up on a read that never answers", async () => {
    behaviorFor = () => "hang";
    hydrateAttemptCount = 1;
    const pending = apiGetSettings();
    const assertion = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);

    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    await assertion;
  });

  it("never times out a write", async () => {
    behaviorFor = () => "hang";
    let settled = false;
    void apiSaveSettings({ businessName: "x" }).finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS * 3);
    expect(settled).toBe(false);
  });
});

describe("initial load", () => {
  it("retries while the server wakes up, then loads", async () => {
    behaviorFor = (attempt) => (attempt === 1 ? "hang" : "ok");
    const attemptsShown: number[] = [];
    const unsubscribe = useAppStore.subscribe((state) => attemptsShown.push(state.hydrateAttempt));
    const loading = useAppStore.getState().hydrateFromApi();

    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    expect(useAppStore.getState().hydrated).toBe(false);
    await vi.advanceTimersByTimeAsync(HYDRATE_RETRY_DELAYS_MS[0]);
    await vi.runOnlyPendingTimersAsync();
    await loading;
    unsubscribe();

    // While retrying, the loading screen showed the "still connecting" state.
    expect(attemptsShown).toContain(2);

    const state = useAppStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.hydrateError).toBe(false);
    expect(state.hydrateAttempt).toBe(0);
    expect(state.settings.businessName).toBe("Alpha");
  });

  it("ends on the error screen instead of spinning forever when the server stays down", async () => {
    behaviorFor = () => "hang";
    const loading = useAppStore.getState().hydrateFromApi();

    const totalWait = READ_TIMEOUT_MS * (HYDRATE_RETRY_DELAYS_MS.length + 1)
      + HYDRATE_RETRY_DELAYS_MS.reduce((sum, delay) => sum + delay, 0);
    await vi.advanceTimersByTimeAsync(totalWait);
    await loading;

    const state = useAppStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.hydrateError).toBe(true);
    expect(hydrateAttemptCount).toBe(HYDRATE_RETRY_DELAYS_MS.length + 1);
  });

  it("retries a temporary server error", async () => {
    behaviorFor = (attempt) => (attempt === 1 ? "server-error" : "ok");
    const loading = useAppStore.getState().hydrateFromApi();

    await vi.advanceTimersByTimeAsync(HYDRATE_RETRY_DELAYS_MS[0]);
    await vi.runOnlyPendingTimersAsync();
    await loading;

    expect(useAppStore.getState().hydrateError).toBe(false);
    expect(hydrateAttemptCount).toBe(2);
  });

  it("does not retry an expired session", async () => {
    behaviorFor = () => "unauthorized";
    await useAppStore.getState().hydrateFromApi();

    expect(hydrateAttemptCount).toBe(1);
    expect(useAppStore.getState().hydrated).toBe(true);
  });
});
