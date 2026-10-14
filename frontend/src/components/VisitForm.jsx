import { useState } from "react";
import { ApiError, createVisit } from "../api/restaurants.js";
import { todayString } from "../utils/date.js";

const FALLBACK = {
  visited_at: "방문일을 확인해 주세요",
  rating: "별점은 1~5 중에서 선택해 주세요",
  comment: "후기를 확인해 주세요",
};

// "가봤어요" 입력 창. 저장에 성공하면 onSaved(visit) 를 부른다.
// 식당이 이미 삭제됐으면(404) onGone 을 부른다.
export default function VisitForm({ restaurant, onSaved, onCancel, onGone }) {
  const today = todayString();
  const [visitedAt, setVisitedAt] = useState(today);
  const [rating, setRating] = useState(""); // "" = 아직 고르지 않음
  const [comment, setComment] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setFormError("");

    // 서버에서도 검사하지만, 빈 값과 미래 날짜는 요청 전에 사유를 보여 준다.
    const errors = {};
    if (!visitedAt) errors.visited_at = "방문일을 입력해 주세요";
    else if (visitedAt > today) errors.visited_at = "미래 날짜는 입력할 수 없습니다";
    if (!rating) errors.rating = "별점을 선택해 주세요";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const visit = await createVisit(restaurant.id, {
        visited_at: visitedAt,
        rating: Number(rating),
        comment: comment.trim() || null,
      });
      onSaved(visit);
    } catch (err) {
      if (err instanceof ApiError && err.kind === "notfound") {
        onGone();
        return;
      }
      if (err instanceof ApiError && err.kind === "validation") {
        // 서버가 준 사유가 한글이면 그대로, 영어 기본 문구면 한글 안내로 바꾼다.
        const mapped = {};
        for (const [key, msg] of Object.entries(err.fieldErrors)) {
          mapped[key] = /[가-힣]/.test(msg) ? msg : (FALLBACK[key] ?? msg);
        }
        setFieldErrors(mapped);
        if (Object.keys(mapped).length === 0) setFormError(err.message);
      } else {
        setFormError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  const err = (key) => fieldErrors[key] && <span className="field-error">{fieldErrors[key]}</span>;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="방문 기록">
      <form className="dialog" onSubmit={submit} noValidate>
        <h2>가봤어요</h2>
        <p className="dialog-sub">{restaurant.name}</p>

        <label>
          방문일 <b className="required">*</b>
          <input type="date" value={visitedAt} max={today} onChange={(e) => setVisitedAt(e.target.value)} />
          {err("visited_at")}
        </label>

        <fieldset className="rating-field">
          <legend>
            별점 <b className="required">*</b>
          </legend>
          <div className="rating-choices">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="rating-choice">
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === String(n)}
                  onChange={(e) => setRating(e.target.value)}
                />
                {n}
              </label>
            ))}
          </div>
          {err("rating")}
        </fieldset>

        <label>
          후기 (선택)
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={300} />
          <span className="char-count">{comment.length}/300</span>
          {err("comment")}
        </label>

        {formError && <p className="form-error" role="alert">{formError}</p>}

        <div className="actions">
          <button type="button" onClick={onCancel} disabled={saving}>취소</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? "저장 중…" : "저장"}</button>
        </div>
      </form>
    </div>
  );
}
