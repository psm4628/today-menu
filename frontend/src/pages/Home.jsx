import { useRef, useState } from "react";
import { fetchRecommendation, fetchRestaurants } from "../api/restaurants.js";
import RestaurantCard from "../components/RestaurantCard.jsx";
import Roulette from "../components/Roulette.jsx";
import useTags from "../hooks/useTags.js";
import { pickSlots } from "../utils/roulette.js";

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
  const [loading, setLoading] = useState(false); // 서버에서 당첨 식당과 후보를 받는 중
  const [spin, setSpin] = useState(null); // { key, slots, winner, winnerIndex } 룰렛 한 판
  const [spinning, setSpinning] = useState(false);
  const seq = useRef(0); // 조건을 바꾸거나 새로 뽑으면 지난 판의 늦은 응답·타이머를 무시한다
  const { tags, error: tagsError } = useTags();

  // 조건을 바꾸면 룰렛과 직전 결과, 제외 정보(result.id)를 함께 지운다.
  const change = (key) => (e) => {
    seq.current += 1;
    setConditions({ ...conditions, [key]: e.target.value });
    setResult(null);
    setSpin(null);
    setSpinning(false);
    setLoading(false);
    setProblem(null);
  };

  async function pick(excludeId) {
    const mySeq = ++seq.current;
    setLoading(true);
    setProblem(null);
    setResult(null); // 룰렛이 멈추기 전에는 결과 카드를 보여주지 않는다
    try {
      // 1) 당첨 식당은 서버(/api/recommend)가 정한다.
      const winner = await fetchRecommendation(conditions, excludeId);
      // 2) 같은 조건의 후보 목록은 룰렛 칸을 채우는 용도일 뿐이다. 못 받으면 당첨 식당 한 칸만 쓴다.
      let candidates = [];
      try {
        candidates = await fetchRestaurants(conditions);
      } catch {
        candidates = [];
      }
      if (mySeq !== seq.current) return;
      const slots = pickSlots(candidates, winner);
      setSpin({ key: mySeq, slots, winner, winnerIndex: slots.findIndex((r) => r.id === winner.id) });
      setSpinning(true);
    } catch (err) {
      if (mySeq !== seq.current) return;
      setSpin(null);
      if (err.kind === "notfound") {
        // 조건 때문인지, 식당이 하나도 없어서인지 구분한다.
        try {
          const all = await fetchRestaurants();
          if (mySeq !== seq.current) return;
          setProblem(all.length === 0 ? "empty" : "nomatch");
        } catch (err2) {
          if (mySeq !== seq.current) return;
          setErrorMsg(err2.message);
          setProblem("error");
        }
      } else {
        setErrorMsg(err.message);
        setProblem("error");
      }
    } finally {
      if (mySeq === seq.current) setLoading(false);
    }
  }

  // 룰렛이 멈춘 뒤에 결과 카드를 보여준다.
  function handleSpinDone() {
    if (spin.key !== seq.current) return;
    setSpinning(false);
    setResult(spin.winner);
  }

  const busy = loading || spinning;

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
      <button className="primary pick" onClick={() => pick(null)} disabled={busy}>
        {busy ? "뽑는 중…" : "뽑기"}
      </button>

      {problem === "nomatch" && <div className="notice">{NO_MATCH_MSG}</div>}

      {problem === "empty" && (
        <div className="notice">
          <p>먼저 식당을 등록해 주세요</p>
          <button className="primary" onClick={onGoToList}>내 식당 목록으로</button>
        </div>
      )}

      {problem === "error" && <div className="notice error" role="alert">{errorMsg}</div>}

      {spin && (
        <Roulette slots={spin.slots} winnerIndex={spin.winnerIndex} spinKey={spin.key} onDone={handleSpinDone} />
      )}

      {result && (
        <ul className="cards">
          <RestaurantCard restaurant={result} />
        </ul>
      )}

      {spin && (
        <button onClick={() => pick(result.id)} disabled={busy || !result}>다시 뽑기</button>
      )}
    </section>
  );
}
