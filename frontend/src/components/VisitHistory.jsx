import { useEffect, useState } from "react";
import { ApiError, fetchVisits } from "../api/restaurants.js";

const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

// 한 식당의 방문 기록을 최근 순으로 보여 주는 창. 후기는 글자로만 표시한다.
export default function VisitHistory({ restaurant, onClose, onGone }) {
  const [visits, setVisits] = useState(null); // null = 불러오는 중
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchVisits(restaurant.id)
      .then((data) => alive && setVisits(data))
      .catch((err) => {
        if (!alive) return;
        if (err instanceof ApiError && err.kind === "notfound") onGone();
        else setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [restaurant.id]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="방문 기록">
      <div className="dialog">
        <h2>방문 기록</h2>
        <p className="dialog-sub">{restaurant.name}</p>

        {error && <p className="form-error" role="alert">{error}</p>}
        {!error && visits === null && <p>불러오는 중…</p>}
        {visits && visits.length === 0 && <p className="notice">아직 방문 기록이 없습니다</p>}
        {visits && visits.length > 0 && (
          <ul className="visit-list">
            {visits.map((v) => (
              <li key={v.id}>
                <div className="visit-head">
                  <span>{v.visited_at}</span>
                  <span className="visit-stars" aria-label={`별점 ${v.rating}점`}>
                    {stars(v.rating)} ({v.rating})
                  </span>
                </div>
                {v.comment && <p className="visit-comment">{v.comment}</p>}
              </li>
            ))}
          </ul>
        )}

        <div className="actions">
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
