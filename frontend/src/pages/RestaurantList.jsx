import { useEffect, useState } from "react";
import { fetchRestaurants } from "../api/restaurants.js";
import RestaurantCard from "../components/RestaurantCard.jsx";
import RestaurantForm from "../components/RestaurantForm.jsx";

export default function RestaurantList() {
  const [restaurants, setRestaurants] = useState(null); // null = 불러오는 중
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  async function load() {
    setError("");
    try {
      setRestaurants(await fetchRestaurants());
    } catch (err) {
      setRestaurants(null);
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleSaved(saved) {
    setRestaurants((prev) => [saved, ...(prev ?? [])]);
    setFormOpen(false);
  }

  return (
    <section>
      <div className="toolbar">
        <h2>내 식당 목록</h2>
        <button className="primary" onClick={() => setFormOpen(true)}>식당 추가</button>
      </div>

      {error && (
        <div className="notice error" role="alert">
          <p>{error}</p>
          <button onClick={load}>다시 시도</button>
        </div>
      )}

      {!error && restaurants === null && <p className="notice">불러오는 중…</p>}

      {restaurants && restaurants.length === 0 && (
        <div className="notice">
          <p>먼저 식당을 등록해 주세요</p>
          <button className="primary" onClick={() => setFormOpen(true)}>식당 등록</button>
        </div>
      )}

      {restaurants && restaurants.length > 0 && (
        <ul className="cards">
          {restaurants.map((r) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
        </ul>
      )}

      {formOpen && <RestaurantForm onSaved={handleSaved} onCancel={() => setFormOpen(false)} />}
    </section>
  );
}
