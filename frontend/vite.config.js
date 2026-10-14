import { defineConfig } from "vite";

// 별도 플러그인 없이 esbuild 로 JSX 를 변환한다.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8004",
    },
  },
});
