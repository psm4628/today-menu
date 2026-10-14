// 룰렛 계산 (화면과 분리해 둔 순수 함수)
// 각도는 위쪽(12시) 포인터를 0도로 하고 시계 방향으로 늘어난다.

export const MAX_SLOTS = 8;
export const SPIN_MS = 3000;

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 룰렛 칸을 만든다. 당첨 식당은 항상 포함하고, 후보가 max 개를 넘으면 무작위로 일부만 쓴다.
// 후보 목록은 칸을 채우는 용도일 뿐 당첨은 서버가 정한 winner 이다.
export function pickSlots(candidates, winner, max = MAX_SLOTS, rng = Math.random) {
  const others = shuffle(candidates.filter((c) => c.id !== winner.id), rng).slice(0, max - 1);
  return shuffle([...others, winner], rng);
}

// 칸 index 가 포인터 아래에 오도록 하는 최종 회전 각도(도).
// n: 칸 수, spins: 추가로 도는 바퀴 수, offset: 칸 안에서 멈출 위치(-0.5~0.5, 0 이 칸 가운데)
export function finalAngle(index, n, spins = 5, offset = 0) {
  const slice = 360 / n;
  const target = (index + 0.5 + offset) * slice; // 회전 전 칸 안의 목표 지점
  return spins * 360 + (((360 - target) % 360) + 360) % 360;
}

// 회전 각도 angle 일 때 포인터 아래에 있는 칸 번호 (검증용)
export function slotUnderPointer(angle, n) {
  const slice = 360 / n;
  const at = ((-angle % 360) + 360) % 360;
  return Math.floor(at / slice) % n;
}
