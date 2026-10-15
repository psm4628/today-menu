import { request } from "./restaurants.js";

const JSON_HEADERS = { "Content-Type": "application/json" };

// 세션 쿠키는 브라우저가 같은 주소의 /api 요청에 자동으로 보낸다.
export function fetchMe() {
  return request("/api/auth/me");
}

export function register(username, password) {
  return request("/api/auth/register", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ username, password }) });
}

export function login(username, password) {
  return request("/api/auth/login", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ username, password }) });
}

export function logout() {
  return request("/api/auth/logout", { method: "POST" });
}
