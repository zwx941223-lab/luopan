import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { PageSection } from "../components/PageSection.jsx";
import { StatusPanel } from "../components/StatusPanel.jsx";
import { fetchFeedback, submitFeedback, useDashboardData } from "../hooks/useDashboardData.js";
import { useAuth } from "../auth.jsx";

export function FeedbackPage() {
  const { token } = useAuth();
  const [content, setContent] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const feedback = useDashboardData(fetchFeedback, [refreshKey]);
  const rows = useMemo(() => feedback.data || [], [feedback.data]);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length < 2) {
      setMessage("请至少填写 2 个字的反馈内容。");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      await submitFeedback(token, trimmed);
      setContent("");
      setMessage("反馈已保存，后续版本会参考这些意见。");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setMessage(error.message || "反馈提交失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <PageSection
        title="意见反馈"
        subtitle="记录运营使用中的问题、建议和优化方向，刷新页面不会丢失"
      >
        <form className="feedback-form setting-card" onSubmit={handleSubmit}>
          <label htmlFor="feedback-content">反馈内容</label>
          <textarea
            id="feedback-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="例如：某个类目切换慢、希望增加某个筛选、某个字段看不懂..."
            rows={5}
            maxLength={1000}
          />
          <div className="feedback-form-footer">
            <span>{content.trim().length}/1000</span>
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? "提交中..." : "提交反馈"}
            </button>
          </div>
          {message ? <p className="feedback-message">{message}</p> : null}
        </form>

        <StatusPanel loading={feedback.loading} error={feedback.error} empty={!rows.length} emptyMessage="暂无反馈记录。">
          <div className="feedback-list">
            {rows.map((item) => (
              <article className="setting-card feedback-card" key={item.id}>
                <div className="feedback-card-head">
                  <strong>{item.displayName || item.username || "运营用户"}</strong>
                  <span>{item.createdAt ? dayjs(item.createdAt).format("YYYY-MM-DD HH:mm:ss") : ""}</span>
                </div>
                <p>{item.content}</p>
              </article>
            ))}
          </div>
        </StatusPanel>
      </PageSection>
    </div>
  );
}
