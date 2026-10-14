import { useCallback, useEffect, useState } from "react";
import { fetchTags } from "../api/restaurants.js";

// 태그 목록을 불러온다. 실패해도 화면 전체는 계속 쓸 수 있도록 error 만 돌려준다.
export default function useTags() {
  const [tags, setTags] = useState([]);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setTags(await fetchTags());
      setError("");
    } catch (err) {
      setError(`태그 목록을 불러오지 못했습니다 (${err.message})`);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // 새로 만든 태그를 목록에 넣는다 (이름 순 유지).
  const addTag = useCallback((tag) => {
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name, "ko")));
  }, []);

  return { tags, error, reload, addTag };
}
