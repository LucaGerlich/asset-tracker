"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { LightModeIcon, DarkModeIcon } from "../ui/Icons.jsx";

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  return (
    <div>
      <Button onClick={toggleTheme} isIconOnly color="default">
        {theme === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
      </Button>
    </div>
  );
};

export default ThemeSwitcher;
