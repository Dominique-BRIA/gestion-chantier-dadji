"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [monte, setMonte] = useState(false);

  useEffect(() => setMonte(true), []);

  if (!monte) return <div className="h-10 w-10" />;

  const sombre = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(sombre ? "light" : "dark")}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      aria-label={sombre ? "Passer en mode clair" : "Passer en mode sombre"}
      title={sombre ? "Mode clair" : "Mode sombre"}
    >
      {sombre ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
