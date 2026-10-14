import { useState } from "react";
import Home from "./pages/Home.jsx";
import RestaurantList from "./pages/RestaurantList.jsx";

const TABS = [
  { id: "home", label: "오늘의 추천" },
  { id: "list", label: "내 식당 목록" },
];

export default function App() {
  const [tab, setTab] = useState("home");

  return (
    <div className="app">
      <header>
        <h1>오늘 뭐 먹지?</h1>
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
