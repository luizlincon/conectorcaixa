import { afterEach, describe, expect, it, vi } from "vitest";
import { canRetryModuleLoad, installModuleRecovery, isModuleLoadError } from "@/lib/module-recovery";

afterEach(() => { vi.unstubAllGlobals(); });

describe("module loading recovery", () => {
  it("recognizes stale module failures without masking application errors", () => {
    expect(isModuleLoadError(new Error("Importing a module script failed."))).toBe(true);
    expect(isModuleLoadError(new Error("Failed to fetch dynamically imported module: /assets/old.js"))).toBe(true);
    expect(isModuleLoadError(new Error("Permission denied"))).toBe(false);
  });
  it("allows only one automatic reload per minute", () => {
    expect(canRetryModuleLoad(Number.NaN, 100_000)).toBe(true);
    expect(canRetryModuleLoad(100_000, 100_001)).toBe(false);
    expect(canRetryModuleLoad(100_000, 160_000)).toBe(true);
  });
  it("reloads the current page on stale preload and prevents a reload loop", () => {
    const target = new EventTarget();
    const reload = vi.fn();
    vi.stubGlobal("window", { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), location: { reload } });
    sessionStorage.clear();
    const remove = installModuleRecovery();
    const event = Object.assign(new Event("vite:preloadError", { cancelable: true }), { payload: new Error("Importing a module script failed.") });
    target.dispatchEvent(event);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    target.dispatchEvent(Object.assign(new Event("vite:preloadError"), { payload: event.payload }));
    expect(reload).toHaveBeenCalledTimes(1);
    remove();
    sessionStorage.clear();
  });
});