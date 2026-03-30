import { createJSONStorage } from "zustand/middleware";

export const APP_STORAGE_KEY = "timeflow-app-store-v2";

const noopStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

export function getBrowserStorage() {
  if (typeof window === "undefined") {
    return noopStorage;
  }

  return window.localStorage;
}

export const appStorage = createJSONStorage(() => getBrowserStorage());
