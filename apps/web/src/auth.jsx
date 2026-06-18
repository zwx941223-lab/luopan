import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "./config.js";

const AuthContext = createContext(null);
const STORAGE_KEY = "dy-monitor-auth";

function readStoredAuth() {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return { token: "", user: null };
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { token: "", user: null };
    }

    const parsed = JSON.parse(raw);
    return {
      token: parsed?.token || "",
      user: parsed?.user || null
    };
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage cleanup failures
    }
    return { token: "", user: null };
  }
}

function writeStoredAuth(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore storage write failures
  }
}

function clearStoredAuth() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage cleanup failures
  }
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(readStoredAuth);
  const [loading, setLoading] = useState(Boolean(readStoredAuth().token));

  useEffect(() => {
    if (!authState.token) {
      setLoading(false);
      return;
    }

    fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${authState.token}`
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("登录已失效");
        }
        const user = await response.json();
        const nextState = { ...authState, user };
        setAuthState(nextState);
        writeStoredAuth(nextState);
      })
      .catch(() => {
        setAuthState({ token: "", user: null });
        clearStoredAuth();
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function login(username, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "登录失败" }));
      throw new Error(error.message || "登录失败");
    }

    const data = await response.json();
    setAuthState(data);
    writeStoredAuth(data);
  }

  function logout() {
    setAuthState({ token: "", user: null });
    clearStoredAuth();
  }

  return (
    <AuthContext.Provider
      value={{
        token: authState.token,
        user: authState.user,
        loading,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
