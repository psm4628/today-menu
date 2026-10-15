import { useState } from "react";
import { ApiError } from "../api/restaurants.js";
import { login, register } from "../api/auth.js";

const FALLBACK = {
  username: "아이디를 확인해 주세요 (영문·숫자·밑줄 3~30자)",
  password: "비밀번호를 확인해 주세요 (8~128자)",
};

// 로그인·회원가입 화면. 성공하면 onLoggedIn(user) 를 부른다. notice 는 만료 안내 같은 알림이다.
export default function AuthPage({ notice, onLoggedIn }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  function switchMode(next) {
    setMode(next);
    setFieldErrors({});
    setFormError("");
    setPassword("");
  }

  async function submit(e) {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");
    setBusy(true);
    try {
      if (isRegister) await register(username, password);
      // 가입하면 바로 로그인한다.
      onLoggedIn(await login(username, password));
    } catch (err) {
      setPassword(""); // 실패하면 비밀번호 칸은 비운다
      if (err instanceof ApiError && err.kind === "validation") {
        const mapped = {};
        for (const [key, msg] of Object.entries(err.fieldErrors)) {
          // 서버 사유가 한글이면 그대로, 영어 기본 문구면 한글 안내로 바꾼다.
          mapped[key] = /[가-힣]/.test(msg) ? msg : (FALLBACK[key] ?? msg);
        }
        setFieldErrors(mapped);
        if (Object.keys(mapped).length === 0) setFormError(err.message);
      } else {
        setFormError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const err = (key) => fieldErrors[key] && <span className="field-error">{fieldErrors[key]}</span>;

  return (
    <div className="app auth-page">
      <header>
        <h1>오늘 뭐 먹지?</h1>
      </header>
      <main>
        <form className="auth-form" onSubmit={submit} noValidate>
          <h2>{isRegister ? "회원가입" : "로그인"}</h2>

          {notice && <p className="notice warn" role="status">{notice}</p>}

          <label>
            아이디
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={30}
              autoComplete="username"
              autoFocus
            />
            {err("username")}
          </label>

          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={128}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
            {err("password")}
          </label>
          {isRegister && <p className="hint">아이디는 영문·숫자·밑줄 3~30자, 비밀번호는 8자 이상입니다.</p>}

          {formError && <p className="form-error" role="alert">{formError}</p>}

          <button type="submit" className="primary pick" disabled={busy}>
            {busy ? "처리 중…" : isRegister ? "가입하고 시작하기" : "로그인"}
          </button>

          <p className="switch">
            {isRegister ? "이미 계정이 있나요? " : "계정이 없나요? "}
            <button type="button" className="link" onClick={() => switchMode(isRegister ? "login" : "register")}>
              {isRegister ? "로그인" : "회원가입"}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}
