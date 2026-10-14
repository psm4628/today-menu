import { useState } from "react";
import { ApiError, createRestaurant } from "../api/restaurants.js";

const CATEGORIES = ["한식", "중식", "일식", "양식", "분식", "카페", "기타"];
const PRICES = [
  { value: "1", label: "저렴" },
  { value: "2", label: "보통" },
  { value: "3", label: "비쌈" },
];
const EMPTY = { name: "", category: "", price_range: "", location: "", memo: "" };

export default function RestaurantForm({ onSaved, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");
    setSaving(true);
    try {
      const saved = await createRestaurant({
        name: form.name,
        category: form.category || null,
        price_range: form.price_range ? Number(form.price_range) : null,
        location: form.location || null,
        memo: form.memo || null,
      });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.kind === "validation") {
        setFieldErrors(err.fieldErrors);
        if (Object.keys(err.fieldErrors).length === 0) setFormError(err.message);
      } else {
        setFormError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  const err = (key) => fieldErrors[key] && <span className="field-error">{fieldErrors[key]}</span>;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="식당 등록">
      <form className="dialog" onSubmit={submit} noValidate>
        <h2>식당 등록</h2>

        <label>
          이름 <b className="required">*</b>
          <input value={form.name} onChange={set("name")} maxLength={100} autoFocus />
          {err("name")}
        </label>

        <label>
          종류
          <select value={form.category} onChange={set("category")}>
            <option value="">선택 안 함</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {err("category")}
        </label>

        <label>
          가격대
          <select value={form.price_range} onChange={set("price_range")}>
            <option value="">선택 안 함</option>
            {PRICES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {err("price_range")}
        </label>

        <label>
          위치
          <input value={form.location} onChange={set("location")} maxLength={200} placeholder="주소나 동네명" />
          {err("location")}
        </label>

        <label>
          메모
          <textarea value={form.memo} onChange={set("memo")} rows={3} maxLength={5000} />
          {err("memo")}
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
