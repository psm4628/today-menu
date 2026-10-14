import { useState } from "react";
import { ApiError, createTag } from "../api/restaurants.js";

// 태그 체크박스 목록 + 새 태그 추가. 태그 이름은 글자로만 표시한다.
export default function TagPicker({ tags, error, onReload, onTagAdded, selected, onToggle, disabled }) {
  const [name, setName] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    setAddError("");
    if (!name.trim()) {
      setAddError("태그 이름을 입력해 주세요");
      return;
    }
    setAdding(true);
    try {
      const tag = await createTag(name);
      onTagAdded(tag);
      onToggle(tag.id, true);
      setName("");
    } catch (err) {
      if (err instanceof ApiError && err.kind === "validation") setAddError("태그 이름을 입력해 주세요");
      else setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <fieldset className="tag-picker">
      <legend>태그</legend>

      {error && (
        <p className="tag-error" role="alert">
          {error} <button type="button" onClick={onReload}>다시 시도</button>
        </p>
      )}

      <div className="tag-checks">
        {tags.map((t) => (
          <label key={t.id} className="tag-check">
            <input
              type="checkbox"
              checked={selected.includes(t.id)}
              onChange={(e) => onToggle(t.id, e.target.checked)}
              disabled={disabled}
            />
            {t.name}
          </label>
        ))}
      </div>

      <div className="tag-add">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // 식당 저장이 아니라 태그 추가로 처리
              add();
            }
          }}
          maxLength={30}
          placeholder="새 태그 이름"
          aria-label="새 태그 이름"
        />
        <button type="button" onClick={add} disabled={adding || disabled}>추가</button>
      </div>
      {addError && <span className="field-error">{addError}</span>}
    </fieldset>
  );
}
