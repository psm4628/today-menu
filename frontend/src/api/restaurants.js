// 백엔드 호출은 항상 /api 상대 경로로만 한다.

export class ApiError extends Error {
  constructor(kind, message, fieldErrors = {}) {
    super(message);
    this.kind = kind; // "validation" | "db" | "notfound" | "conflict" | "unauthorized" | "toomany" | "server"
    this.fieldErrors = fieldErrors;
  }
}

const SERVER_MSG = "요청을 처리하지 못했습니다";
const DB_MSG = "DB에 연결할 수 없습니다";

// 로그인이 필요한 요청이 401 이면(세션 만료 등) 앱이 로그인 화면으로 돌아가도록 알린다. 인증 요청(/api/auth/)은 제외.
let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

async function detailOf(res, fallback) {
  const body = await res.json().catch(() => null);
  return typeof body?.detail === "string" ? body.detail : fallback;
}

export async function request(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new ApiError("server", SERVER_MSG);
  }
  if (res.ok) return res.status === 204 ? null : res.json();

  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    const fieldErrors = {};
    if (Array.isArray(body.detail)) {
      for (const d of body.detail) {
        const field = d.loc?.[d.loc.length - 1];
        if (typeof field === "string" && !(field in fieldErrors)) {
          fieldErrors[field] = d.msg.replace(/^Value error, /, "");
        }
      }
    }
    throw new ApiError("validation", "입력값을 확인해 주세요", fieldErrors);
  }
  if (res.status === 401) {
    const message = await detailOf(res, "로그인이 필요합니다");
    if (!path.startsWith("/api/auth/")) unauthorizedHandler?.();
    throw new ApiError("unauthorized", message);
  }
  if (res.status === 429) throw new ApiError("toomany", await detailOf(res, "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요"));
  if (res.status === 503) throw new ApiError("db", DB_MSG);
  if (res.status === 404) throw new ApiError("notfound", "조건에 맞는 식당이 없습니다");
  if (res.status === 409) throw new ApiError("conflict", await detailOf(res, "이미 있는 태그입니다"));
  throw new ApiError("server", SERVER_MSG);
}

// 조건: { q, category, price_range, status, tag_id, favorite } (빈 값은 보내지 않는다. favorite 는 "true" 일 때만). 거르는 일은 서버가 한다.
export function fetchRestaurants(conditions = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(conditions)) {
    const v = typeof value === "string" ? value.trim() : value;
    if (v) params.set(key, v);
  }
  const query = params.toString();
  return request(`/api/restaurants${query ? `?${query}` : ""}`);
}

export function createRestaurant(data) {
  return request("/api/restaurants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// 조건: { category, price_range, status } (빈 값은 보내지 않는다), excludeId: 직전 결과 id
export function fetchRecommendation(conditions, excludeId) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(conditions)) {
    if (value) params.set(key, value);
  }
  if (excludeId) params.set("exclude_id", String(excludeId));
  const query = params.toString();
  return request(`/api/recommend${query ? `?${query}` : ""}`);
}

export function updateRestaurant(id, data) {
  return request(`/api/restaurants/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deleteRestaurant(id) {
  return request(`/api/restaurants/${id}`, { method: "DELETE" });
}

export function fetchTags() {
  return request("/api/tags");
}

export function createTag(name) {
  return request("/api/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

// 식당의 태그를 통째로 바꾼다. 갱신된 식당을 돌려준다.
export function setRestaurantTags(id, tagIds) {
  return request(`/api/restaurants/${id}/tags`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag_ids: tagIds }),
  });
}

// 즐겨찾기만 바꾼다. 갱신된 식당을 돌려준다.
export function setFavorite(id, isFavorite) {
  return request(`/api/restaurants/${id}/favorite`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_favorite: isFavorite }),
  });
}

// 방문 기록 추가. 성공하면 서버가 그 식당의 status 를 VISITED 로 바꾼다.
export function createVisit(id, data) {
  return request(`/api/restaurants/${id}/visits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// 방문 기록 목록 (최근 방문일 순)
export function fetchVisits(id) {
  return request(`/api/restaurants/${id}/visits`);
}
