"use client";

import React, { useEffect, useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import ThemeSwitcher from "./ThemeSwitcher.jsx";

function Navigation({ userName }) {
  const route = usePathname();
  const [active, setActive] = useState("");
  useEffect(() => {
    setActive(route.split("/")[1] || "");
  }, [route]);

  const isActive = (p) => (active === p ? "text-primary" : "text-foreground");

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-default-200 bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <NextLink href="/" className="font-bold">Asset Tracker</NextLink>
          <div className="hidden sm:flex items-center gap-4 text-sm">
            <NextLink href="/user" className={isActive("user")}>Users</NextLink>
            <NextLink href="/assets" className={isActive("assets")}>Assets</NextLink>
            <NextLink href="/accessories" className={isActive("accessories")}>Accessories</NextLink>
            <NextLink href="/locations" className={isActive("locations")}>Locations</NextLink>
            <NextLink href="/manufacturers" className={isActive("manufacturers")}>Manufacturer</NextLink>
            <NextLink href="/suppliers" className={isActive("suppliers")}>Supplier</NextLink>
            <NextLink href="/licences" className={isActive("licences")}>Licences</NextLink>
            <NextLink href="/consumables" className={isActive("consumables")}>Consumables</NextLink>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden md:inline text-foreground-500">Signed in as</span>
            <span className="font-medium">{userName}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
