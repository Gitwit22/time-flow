/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Minutes of inactivity before showing the session-expiry warning (default 55). */
  readonly VITE_IDLE_WARNING_MINUTES?: string;
  /** Minutes of inactivity before auto-logout (default 60). */
  readonly VITE_IDLE_LOGOUT_MINUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
