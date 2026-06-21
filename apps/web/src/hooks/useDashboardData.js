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

export function fetchRankingRows(token, categoryId = "", refreshKey = "", options = {}) {
  const params = new URLSearchParams();
  if (categoryId) {
    params.set("categoryId", categoryId);
  }
  if (options.viewMode) {
    params.set("viewMode", options.viewMode);
  }
  params.set("page", String(options.page || 1));
  params.set("pageSize", String(options.pageSize || 50));
  params.set("_", refreshKey || String(Date.now()));
  return apiRequest(`/monitor/ranking-rows?${params.toString()}`, { token });
}

export function fetchDiffs(token, categoryId = "", options = {}) {
  const params = new URLSearchParams();
  if (categoryId) {
    params.set("categoryId", categoryId);
  }
  params.set("page", String(options.page || 1));
  params.set("pageSize", String(options.pageSize || 50));
  return apiRequest(`/monitor/diffs?${params.toString()}`, { token });
}

export function fetchHistory(token, options = {}) {
  const params = new URLSearchParams();
  params.set("page", String(options.page || 1));
  params.set("pageSize", String(options.pageSize || 50));
  params.set("limit", String(options.limit || 1000));
  return apiRequest(`/monitor/history?${params.toString()}`, { token });
}

export function fetchFeedback(token) {
  return apiRequest("/feedback", { token });
}

export function submitFeedback(token, content) {
  return apiRequest("/feedback", {
    token,
    method: "POST",
    body: { content }
  });
}
