const PRICE_LABEL = { 1: "저렴", 2: "보통", 3: "비쌈" };

// 사용자 입력은 JSX 텍스트로만 출력한다 (React 가 이스케이프).
// children 은 카드 아래쪽 버튼 영역(목록 화면에서만 넘긴다).
export default function RestaurantCard({ restaurant, children }) {
  const { name, category, price_range, location, memo, tags = [], is_favorite } = restaurant;
  return (
    <li className="card">
      <h3>
        {is_favorite && <span className="fav-star" role="img" aria-label="즐겨찾기">★ </span>}
        {name}
      </h3>
      <p className="meta">
        {category && <span className="badge">{category}</span>}
        {price_range && <span className="badge">{PRICE_LABEL[price_range]}</span>}
      </p>
      {tags.length > 0 && (
        <p className="meta">
          {tags.map((t) => (
            <span key={t.id} className="badge tag">#{t.name}</span>
          ))}
        </p>
      )}
      {location && <p>📍 {location}</p>}
      {memo && <p className="memo">{memo}</p>}
      {children && <div className="card-actions">{children}</div>}
    </li>
  );
}
