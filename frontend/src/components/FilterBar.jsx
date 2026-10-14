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

// 검색어(q)는 입력 즉시 바뀌고, 요청 시점(0.4초 뒤)은 목록 화면이 정한다.
export default function FilterBar({ filters, onChange, tags, tagsError }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  const select = (key, label, options) => (
    <label>
      {label}
      <select value={filters[key]} onChange={set(key)}>
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
    <div className="filter-bar">
      <label className="search">
        이름 검색
        <input type="search" value={filters.q} onChange={set("q")} maxLength={100} placeholder="식당 이름" />
      </label>
      <div className="conditions">
        {select("category", "종류", CATEGORIES)}
        {select("price_range", "가격대", PRICES)}
        {select("status", "방문 상태", STATUSES)}
        {select("tag_id", "태그", tags.map((t) => ({ value: String(t.id), label: t.name })))}
      </div>
      {tagsError && <p className="tag-error">{tagsError}</p>}
      <label className="favorite-only">
        <input
          type="checkbox"
          checked={filters.favorite === "true"}
          onChange={(e) => onChange({ ...filters, favorite: e.target.checked ? "true" : "" })}
        />
        즐겨찾기만 보기
      </label>
    </div>
  );
}
