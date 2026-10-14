import { useEffect, useState } from "react";
import { ApiError, deleteRestaurant, fetchRestaurants } from "../api/restaurants.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import RestaurantCard from "../components/RestaurantCard.jsx";
import RestaurantForm from "../components/RestaurantForm.jsx";

const GONE_MSG = "이미 삭제된 식당입니다";

export default function RestaurantList() {
  const [restaurants, setRestaurants] = useState(null); // null = 불러오는 중
  const [error, setError] = useState("");
  const [message, setMessage] = useState(""); // 목록 위 안내 (예: 이미 삭제된 식당)
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // 수정 중인 식당
  const [deleting, setDeleting] = useState(null); // 삭제 확인 중인 식당
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  function handleCreated(saved) {
    setRestaurants((prev) => [saved, ...(prev ?? [])]);
    setFormOpen(false);
  }

  function handleUpdated(saved) {
    setRestaurants((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    setEditing(null);
    setMessage("");
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
      setRestaurants((prev) => prev.filter((r) => r.id !== deleting.id));
      setDeleting(null);
      setMessage("");
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

      {message && <div className="notice warn" role="status">{message}</div>}

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
