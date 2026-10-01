"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LightModeIcon, DarkModeIcon } from "../ui/Icons";

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional hydration guard
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  return (
    <div>
      <Button
        onClick={toggleTheme}
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
      </Button>
    </div>
  );
};

export default ThemeSwitcher;
