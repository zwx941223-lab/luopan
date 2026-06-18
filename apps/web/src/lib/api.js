import { API_BASE_URL } from "../config.js";

export async function apiRequest(path, { token, method = "GET", body, responseType = "json" } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    cache: method === "GET" ? "no-store" : "default",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method === "GET" ? { "Cache-Control": "no-cache" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    let message = "请求失败";
    try {
      const error = await response.json();
      message = error.message || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (responseType === "blob") {
    return response.blob();
  }

  return response.json();
}
