import { useState } from "react";
import { ApiError, createRestaurant, setRestaurantTags, updateRestaurant } from "../api/restaurants.js";
import TagPicker from "./TagPicker.jsx";

const CATEGORIES = ["한식", "중식", "일식", "양식", "분식", "카페", "기타"];
const PRICES = [
  { value: "1", label: "저렴" },
  { value: "2", label: "보통" },
  { value: "3", label: "비쌈" },
];
const EMPTY = { name: "", category: "", price_range: "", location: "", memo: "" };

// restaurant 를 넘기면 수정 창(현재 값이 채워진 상태), 없으면 등록 창이다.
// 수정 중 404(이미 삭제됨)가 나오면 onGone 을 호출한다.
// tags/tagsError/onTagsReload/onTagAdded: 태그 목록(부모가 들고 있다). onChanged: 식당은 저장됐지만 창은 열려 있을 때 목록을 새로 받게 한다.
export default function RestaurantForm({
  restaurant, tags, tagsError, onTagsReload, onTagAdded, onSaved, onChanged, onCancel, onGone,
}) {
  // 등록했는데 태그 설정만 실패하면 식당은 이미 저장된 것이므로, 다시 저장할 때 새로 만들지 않고 그 식당을 수정한다.
  const [savedId, setSavedId] = useState(null);
  const targetId = restaurant?.id ?? savedId;
  const editing = targetId !== null && targetId !== undefined;
  const [selectedTags, setSelectedTags] = useState((restaurant?.tags ?? []).map((t) => t.id));
  const [baselineTags, setBaselineTags] = useState((restaurant?.tags ?? []).map((t) => t.id)); // 서버에 설정돼 있는 태그
  const [form, setForm] = useState(
    restaurant
      ? {
          name: restaurant.name,
          category: restaurant.category ?? "",
          price_range: restaurant.price_range ? String(restaurant.price_range) : "",
          location: restaurant.location ?? "",
          memo: restaurant.memo ?? "",
        }
      : EMPTY,
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const toggleTag = (id, on) =>
    setSelectedTags((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  const sameTags = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

  async function submit(e) {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");
    setSaving(true);
    try {
      const data = {
        name: form.name,
        category: form.category || null,
        price_range: form.price_range ? Number(form.price_range) : null,
        location: form.location || null,
        memo: form.memo || null,
      };
      let saved = editing ? await updateRestaurant(targetId, data) : await createRestaurant(data);
      setSavedId(saved.id);
      if (!sameTags(selectedTags, baselineTags)) {
        try {
          saved = await setRestaurantTags(saved.id, selectedTags);
          setBaselineTags(selectedTags);
        } catch (tagErr) {
          if (tagErr instanceof ApiError && tagErr.kind === "notfound") {
            onGone();
            return;
          }
          // 식당은 저장됐다. 창을 열어 둔 채 태그만 다시 시도하게 한다.
          setFormError(`식당은 저장됐지만 태그를 설정하지 못했습니다 (${tagErr.message}). 태그를 확인하고 다시 저장해 주세요.`);
          onChanged?.();
          return;
        }
      }
      onSaved(saved);
    } catch (err) {
      if (editing && err instanceof ApiError && err.kind === "notfound") {
        onGone();
        return;
      } else if (err instanceof ApiError && err.kind === "validation") {
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
    <div className="overlay" role="dialog" aria-modal="true" aria-label={editing ? "식당 수정" : "식당 등록"}>
      <form className="dialog" onSubmit={submit} noValidate>
        <h2>{editing ? "식당 수정" : "식당 등록"}</h2>

        <label>
          이름 <b className="required">*</b>
          <input value={form.name} onChange={set("name")} maxLength={100} autoFocus />
          {err("name")}
        </label>

        <label>
          종류
          <select value={form.category} onChange={set("category")}>
            <option value="">선택 안 함</option>
            {(form.category && !CATEGORIES.includes(form.category) ? [form.category, ...CATEGORIES] : CATEGORIES).map((c) => (
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

        <TagPicker
          tags={tags}
          error={tagsError}
          onReload={onTagsReload}
          onTagAdded={onTagAdded}
          selected={selectedTags}
          onToggle={toggleTag}
          disabled={saving}
        />

        {formError && <p className="form-error" role="alert">{formError}</p>}

        <div className="actions">
          <button type="button" onClick={onCancel} disabled={saving}>취소</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? "저장 중…" : "저장"}</button>
        </div>
      </form>
    </div>
  );
}
