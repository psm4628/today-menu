import RestaurantList from "./pages/RestaurantList.jsx";

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>오늘 뭐 먹지?</h1>
      </header>
      <main>
        <RestaurantList />
      </main>
    </div>
  );
}
