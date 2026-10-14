import { useEffect, useRef, useState } from "react";
import { ApiError, deleteRestaurant, fetchRestaurants } from "../api/restaurants.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import FilterBar from "../components/FilterBar.jsx";
import RestaurantCard from "../components/RestaurantCard.jsx";
import RestaurantForm from "../components/RestaurantForm.jsx";

const GONE_MSG = "이미 삭제된 식당입니다";
const NO_FILTER = { q: "", category: "", price_range: "", status: "" };
const SEARCH_DELAY_MS = 400;

export default function RestaurantList() {
  const [restaurants, setRestaurants] = useState(null); // null = 불러오는 중
  const [filters, setFilters] = useState(NO_FILTER); // 화면에 보이는 입력값
  const [searchQ, setSearchQ] = useState(""); // 입력이 멈춘 뒤 서버에 보내는 검색어
  const requestSeq = useRef(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(""); // 목록 위 안내 (예: 이미 삭제된 식당)
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // 수정 중인 식당
  const [deleting, setDeleting] = useState(null); // 삭제 확인 중인 식당
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  // 서버에 보내는 현재 조건 (검색어는 입력이 멈춘 값)
  const applied = { ...filters, q: searchQ };
  const hasFilter = Object.values(applied).some((v) => v.trim() !== "");

  async function load() {
    const seq = ++requestSeq.current;
    setError("");
    try {
      const data = await fetchRestaurants(applied);
      if (seq === requestSeq.current) setRestaurants(data); // 늦게 도착한 옛 응답은 버린다
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setRestaurants(null);
      setError(err.message);
    }
  }

  // 검색어는 입력이 멈춘 뒤 0.4초 후에 반영한다.
  useEffect(() => {
    const timer = setTimeout(() => setSearchQ(filters.q), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [filters.q]);

  // 선택을 바꾸면 바로, 검색어는 위 지연이 끝나면 요청한다.
  useEffect(() => {
    load();
  }, [searchQ, filters.category, filters.price_range, filters.status]);

  function clearFilters() {
    setFilters(NO_FILTER);
    setSearchQ("");
  }

  // 추가·수정·삭제 뒤에는 현재 조건 그대로 서버에서 다시 받아 온다.
  function handleCreated() {
    setFormOpen(false);
    load();
  }

  function handleUpdated() {
    setEditing(null);
    setMessage("");
    load();
  }

  // 수정·삭제 중 이미 삭제된 식당(404)임을 알게 된 경우
  function handleGone() {
    setEditing(null);
    setDeleting(null);
    setMessage(GONE_MSG);
    load();
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteRestaurant(deleting.id);
      setDeleting(null);
      setMessage("");
      load();
    } catch (err) {
      if (err instanceof ApiError && err.kind === "notfound") handleGone();
      else setDeleteError(err.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  function askDelete(restaurant) {
    setDeleteError("");
    setDeleting(restaurant);
  }

  return (
    <section>
      <div className="toolbar">
        <h2>내 식당 목록</h2>
        <button className="primary" onClick={() => setFormOpen(true)}>식당 추가</button>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      {message && <div className="notice warn" role="status">{message}</div>}

      {error && (
        <div className="notice error" role="alert">
          <p>{error}</p>
          <button onClick={load}>다시 시도</button>
        </div>
      )}

      {!error && restaurants === null && <p className="notice">불러오는 중…</p>}

      {restaurants && restaurants.length === 0 && hasFilter && (
        <div className="notice">
          <p>조건에 맞는 식당이 없습니다</p>
          <button onClick={clearFilters}>조건 지우기</button>
        </div>
      )}

      {restaurants && restaurants.length === 0 && !hasFilter && (
        <div className="notice">
          <p>먼저 식당을 등록해 주세요</p>
          <button className="primary" onClick={() => setFormOpen(true)}>식당 등록</button>
        </div>
      )}

      {restaurants && restaurants.length > 0 && (
        <ul className="cards">
          {restaurants.map((r) => (
            <RestaurantCard key={r.id} restaurant={r}>
              <button onClick={() => { setMessage(""); setEditing(r); }}>수정</button>
              <button className="danger-outline" onClick={() => askDelete(r)}>삭제</button>
            </RestaurantCard>
          ))}
        </ul>
      )}

      {formOpen && <RestaurantForm onSaved={handleCreated} onCancel={() => setFormOpen(false)} />}

      {editing && (
        <RestaurantForm
          restaurant={editing}
          onSaved={handleUpdated}
          onCancel={() => setEditing(null)}
          onGone={handleGone}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="정말 삭제할까요?"
          message={`'${deleting.name}' 식당을 삭제합니다. 되돌릴 수 없습니다.`}
          error={deleteError}
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
