import { useEffect, useState } from "react";

export default function HomeHeader({ user }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hour = now.getHours();

  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 17
      ? "Good afternoon"
      : "Good evening";

  const name = user?.name || "User";

  const date = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <header className="flex items-center justify-between gap-3 mb-6">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 mb-1">
          {date}
        </p>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          {greeting}, {name.split(" ")[0]} 👋
        </h1>

        <p className="text-sm text-slate-500 mt-1">
          Ready to manage your expenses?
        </p>
      </div>

      <button
        type="button"
        className="shrink-0 w-12 h-12 rounded-full bg-blue-600
                   text-white font-bold text-lg flex items-center
                   justify-center shadow-md"
        aria-label="Open profile"
      >
        {name.charAt(0).toUpperCase()}
      </button>
    </header>
  );
}