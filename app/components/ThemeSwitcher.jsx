"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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

  return <Button onClick={toggleTheme} variant="light">{theme === "dark" ? <LightModeIcon /> : <DarkModeIcon />}</Button>;
};

export default ThemeSwitcher;
