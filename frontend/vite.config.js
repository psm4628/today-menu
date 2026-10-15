import { defineConfig } from "vite";

// 별도 플러그인 없이 esbuild 로 JSX 를 변환한다.
// 개발 서버는 /api 를 기본으로 8004 서비스에 연결한다.
// 서버에 반영하기 전의 새 백엔드(8005 확인용 서버)로 화면을 확인할 때는 API_PROXY_TARGET=http://127.0.0.1:8005 npm run dev
const apiTarget = process.env.API_PROXY_TARGET || "http://127.0.0.1:8004";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  server: {
    proxy: {
      "/api": apiTarget,
    },
  },
});
