import { useCallback, useEffect, useState } from "react";
import { ApiError, setUnauthorizedHandler } from "./api/restaurants.js";
import { fetchMe, logout } from "./api/auth.js";
import AuthPage from "./pages/AuthPage.jsx";
import Home from "./pages/Home.jsx";
import RestaurantList from "./pages/RestaurantList.jsx";

const TABS = [
  { id: "home", label: "오늘의 추천" },
  { id: "list", label: "내 식당 목록" },
];

const EXPIRED_MSG = "로그인이 만료되었습니다. 다시 로그인해 주세요";

// 로그인한 사용자의 화면. App 이 user.id 를 key 로 주므로 로그아웃·계정 전환 때 탭·룰렛·결과·필터 상태가 모두 새로 시작된다.
function Main({ user, onLogout, logoutBusy }) {
  const [tab, setTab] = useState("home");

  return (
    <div className="app">
      <header>
        <div className="topbar">
          <h1>오늘 뭐 먹지?</h1>
          <div className="userbox">
            <span className="username">{user.username}</span>
            <button onClick={onLogout} disabled={logoutBusy}>로그아웃</button>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "tab active" : "tab"}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === "home" ? <Home onGoToList={() => setTab("list")} /> : <RestaurantList />}
      </main>
    </div>
  );
}

export default function App() {
  // status: "loading" | "anon" | "user" | "error"
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [logoutBusy, setLogoutBusy] = useState(false);

  const checkSession = useCallback(async () => {
    setStatus("loading");
    try {
      setUser(await fetchMe());
      setStatus("user");
    } catch (err) {
      if (err instanceof ApiError && err.kind === "unauthorized") {
        setUser(null);
        setStatus("anon");
      } else {
        setErrorMsg(err.message);
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // 로그인이 필요한 요청이 401 이면(세션 만료, 다른 곳에서 로그아웃) 안내와 함께 로그인 화면으로 돌아간다.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setNotice(EXPIRED_MSG);
      setStatus("anon");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  async function handleLogout() {
    setLogoutBusy(true);
    try {
      await logout();
    } catch {
      // 서버에 닿지 않아도 이 화면에서는 로그아웃한다 (세션은 만료로 정리된다).
    } finally {
      setLogoutBusy(false);
      setUser(null);
      setNotice("");
      setStatus("anon");
    }
  }

  if (status === "loading") {
    return <div className="app"><p className="notice">불러오는 중…</p></div>;
  }
  if (status === "error") {
    return (
      <div className="app">
        <div className="notice error" role="alert">
          <p>{errorMsg}</p>
          <button onClick={checkSession}>다시 시도</button>
        </div>
      </div>
    );
  }
  if (status === "anon") {
    return (
      <AuthPage
        notice={notice}
        onLoggedIn={(u) => {
          setUser(u);
          setNotice("");
          setStatus("user");
        }}
      />
    );
  }
  return <Main key={user.id} user={user} onLogout={handleLogout} logoutBusy={logoutBusy} />;
}
