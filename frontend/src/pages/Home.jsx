import { useState } from "react";
import { fetchRecommendation, fetchRestaurants } from "../api/restaurants.js";
import RestaurantCard from "../components/RestaurantCard.jsx";
import useTags from "../hooks/useTags.js";

const CATEGORIES = ["한식", "중식", "일식", "양식", "분식", "카페", "기타"];
const PRICES = [
  { value: "1", label: "저렴" },
  { value: "2", label: "보통" },
  { value: "3", label: "비쌈" },
];
const STATUSES = [
  { value: "WANT", label: "가보고 싶음" },
  { value: "VISITED", label: "가봄" },
];
const NO_MATCH_MSG = "조건에 맞는 식당이 없습니다. 조건을 바꿔 보세요";

export default function Home({ onGoToList }) {
  const [conditions, setConditions] = useState({ category: "", price_range: "", status: "", tag_id: "" });
  const [result, setResult] = useState(null);
  // null | "nomatch"(조건에 맞는 식당 없음) | "empty"(등록된 식당 없음) | "error"
  const [problem, setProblem] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const { tags, error: tagsError } = useTags();

  // 조건을 바꾸면 직전 결과와 제외 정보(result.id)를 함께 지운다.
  const change = (key) => (e) => {
    setConditions({ ...conditions, [key]: e.target.value });
    setResult(null);
    setProblem(null);
  };

  async function pick(excludeId) {
    setLoading(true);
    setProblem(null);
    try {
      setResult(await fetchRecommendation(conditions, excludeId));
    } catch (err) {
      setResult(null);
      if (err.kind === "notfound") {
        // 조건 때문인지, 식당이 하나도 없어서인지 구분한다.
        try {
          const all = await fetchRestaurants();
          setProblem(all.length === 0 ? "empty" : "nomatch");
        } catch (err2) {
          setErrorMsg(err2.message);
          setProblem("error");
        }
      } else {
        setErrorMsg(err.message);
        setProblem("error");
      }
    } finally {
      setLoading(false);
    }
  }

  const select = (key, label, options) => (
    <label>
      {label}
      <select value={conditions[key]} onChange={change(key)}>
        <option value="">전체</option>
        {options.map((o) => {
          const value = typeof o === "string" ? o : o.value;
          const text = typeof o === "string" ? o : o.label;
          return <option key={value} value={value}>{text}</option>;
        })}
      </select>
    </label>
  );

  return (
    <section>
      <h2>오늘의 추천</h2>

      <div className="conditions">
        {select("category", "종류", CATEGORIES)}
        {select("price_range", "가격대", PRICES)}
        {select("status", "방문 상태", STATUSES)}
        {select("tag_id", "태그", tags.map((t) => ({ value: String(t.id), label: t.name })))}
      </div>
      {tagsError && <p className="tag-error">{tagsError}</p>}
      <button className="primary pick" onClick={() => pick(null)} disabled={loading}>
        {loading && !result ? "뽑는 중…" : "뽑기"}
      </button>

      {problem === "nomatch" && <div className="notice">{NO_MATCH_MSG}</div>}

      {problem === "empty" && (
        <div className="notice">
          <p>먼저 식당을 등록해 주세요</p>
          <button className="primary" onClick={onGoToList}>내 식당 목록으로</button>
        </div>
      )}

      {problem === "error" && <div className="notice error" role="alert">{errorMsg}</div>}

      {result && (
        <>
          <ul className="cards">
            <RestaurantCard restaurant={result} />
          </ul>
          <button onClick={() => pick(result.id)} disabled={loading}>다시 뽑기</button>
        </>
      )}
    </section>
  );
}
