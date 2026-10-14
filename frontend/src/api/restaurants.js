// 백엔드 호출은 항상 /api 상대 경로로만 한다.

export class ApiError extends Error {
  constructor(kind, message, fieldErrors = {}) {
    super(message);
    this.kind = kind; // "validation" | "db" | "server"
    this.fieldErrors = fieldErrors;
  }
}

const SERVER_MSG = "요청을 처리하지 못했습니다";
const DB_MSG = "DB에 연결할 수 없습니다";

async function request(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new ApiError("server", SERVER_MSG);
  }
  if (res.ok) return res.json();

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
  if (res.status === 503) throw new ApiError("db", DB_MSG);
  throw new ApiError("server", SERVER_MSG);
}

export function fetchRestaurants() {
  return request("/api/restaurants");
}

export function createRestaurant(data) {
  return request("/api/restaurants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
