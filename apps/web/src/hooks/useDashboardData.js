import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { useAuth } from "../auth.jsx";

export function useDashboardData(loader, deps = []) {
  const { token } = useAuth();
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: "", data: null });

    loader(token)
      .then((data) => {
        if (!cancelled) {
          setState({ loading: false, error: "", data });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ loading: false, error: error.message || "加载失败", data: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, ...deps]);

  return state;
}

export function fetchOverview(token) {
  return apiRequest("/monitor/overview", { token });
}

export function fetchCategories(token) {
  return apiRequest(`/categories?_=${Date.now()}`, { token });
}

export function fetchRecords(token, categoryId = "") {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
  return apiRequest(`/monitor/records${query}`, { token });
}

export function fetchRankingRows(token, categoryId = "", refreshKey = "", viewMode = "") {
  const params = new URLSearchParams();
  if (categoryId) {
    params.set("categoryId", categoryId);
  }
  if (viewMode) {
    params.set("viewMode", viewMode);
  }
  params.set("_", refreshKey || String(Date.now()));
  return apiRequest(`/monitor/ranking-rows?${params.toString()}`, { token });
}

export function fetchDiffs(token, categoryId = "") {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
  return apiRequest(`/monitor/diffs${query}`, { token });
}

export function fetchHistory(token) {
  return apiRequest("/monitor/history?limit=300", { token });
}
