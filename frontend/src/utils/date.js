// 오늘 날짜를 YYYY-MM-DD 로 (브라우저 기준)
export function todayString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
