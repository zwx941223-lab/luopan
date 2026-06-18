import { APP_VERSION } from "./config.js";

const CACHE_VERSION_KEY = "dy-monitor-cache-version";
const AUTH_KEY = "dy-monitor-auth";

export function resetStaleClientCache() {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const currentVersion = window.localStorage.getItem(CACHE_VERSION_KEY);
  if (currentVersion === APP_VERSION) {
    return;
  }

  const auth = window.localStorage.getItem(AUTH_KEY);
  window.localStorage.clear();
  window.sessionStorage?.clear?.();
  if (auth) {
    window.localStorage.setItem(AUTH_KEY, auth);
  }
  window.localStorage.setItem(CACHE_VERSION_KEY, APP_VERSION);
}
