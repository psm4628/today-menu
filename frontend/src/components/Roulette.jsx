import { useLayoutEffect, useRef } from "react";
import { SPIN_MS, finalAngle } from "../utils/roulette.js";

const COLORS = ["#ffd8a8", "#d0ebff", "#d8f5a2", "#ffdeeb", "#e5dbff", "#c5f6fa", "#fff3bf", "#ffc9c9"];
const R = 96;

const point = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [(r * Math.sin(a)).toFixed(3), (-r * Math.cos(a)).toFixed(3)];
};

function shorten(name, max = 8) {
  const chars = Array.from(name);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : name;
}

// slots: 칸에 들어갈 식당 목록, winnerIndex: 서버가 뽑은 식당의 칸 번호
// spinKey 가 바뀔 때마다 각도를 0 으로 되돌린 뒤 새로 돌린다. 멈추면 onDone 을 부른다.
export default function Roulette({ slots, winnerIndex, spinKey, onDone }) {
  const wheelRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useLayoutEffect(() => {
    const el = wheelRef.current;
    // 칸 안에서 멈추는 위치는 가운데에서 조금 흩뜨린다 (칸 경계에는 걸리지 않게 ±0.3).
    const angle = finalAngle(winnerIndex, slots.length, 5, (Math.random() - 0.5) * 0.6);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    el.style.transition = "none";
    el.style.transform = "rotate(0deg)"; // 매번 처음 각도에서 시작
    void el.offsetWidth; // 위 초기화가 먼저 적용되도록 강제로 반영

    if (reduced) {
      el.style.transform = `rotate(${angle}deg)`;
      doneRef.current();
      return undefined;
    }
    el.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.6, 0.15, 1)`;
    el.style.transform = `rotate(${angle}deg)`;
    const timer = setTimeout(() => doneRef.current(), SPIN_MS);
    return () => clearTimeout(timer);
  }, [spinKey]);

  const n = slots.length;
  const slice = 360 / n;

  return (
    <div className="roulette">
      <div className="roulette-pointer" aria-hidden="true">▼</div>
      <div className="roulette-wheel" ref={wheelRef}>
        <svg viewBox="-100 -100 200 200" role="img" aria-label="룰렛">
          {slots.map((r, i) => {
            const start = i * slice;
            const mid = start + slice / 2;
            const [x1, y1] = point(start, R);
            const [x2, y2] = point(start + slice, R);
            const fill = COLORS[i % COLORS.length];
            return (
              <g key={r.id}>
                {n === 1 ? (
                  <circle r={R} fill={fill} stroke="#fff" strokeWidth="1" />
                ) : (
                  <path
                    d={`M0,0 L${x1},${y1} A${R},${R} 0 ${slice > 180 ? 1 : 0} 1 ${x2},${y2} Z`}
                    fill={fill}
                    stroke="#fff"
                    strokeWidth="1"
                  />
                )}
                {/* 식당 이름은 SVG text 로만 넣는다 (React 가 이스케이프) */}
                <text
                  transform={`rotate(${mid - 90})`}
                  x={R - 8}
                  y={3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#333"
                >
                  {shorten(r.name)}
                </text>
              </g>
            );
          })}
          <circle r="5" fill="#fff" stroke="#bbb" />
        </svg>
      </div>
    </div>
  );
}
