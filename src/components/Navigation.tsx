"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import ThemeSwitcher from "./ThemeSwitcher";
import { SignOutButton } from "./SignOutButton";
import GlobalSearch from "./GlobalSearch";
import { ChevronDown, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { NotificationIcon } from "../ui/Icons";
import { cn } from "@/lib/utils";

function Navigation() {
  const route = usePathname();
  const [activeMenu, setActiveMenu] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: session } = useSession();

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    const routeSegment = route.split("/")[1];
    setActiveMenu(routeSegment);
  }, [route]);

  const isActive = (path) => {
    return activeMenu === path;
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (session?.user?.firstname && session?.user?.lastname) {
      return `${session.user.firstname[0]}${session.user.lastname[0]}`.toUpperCase();
    }
    if (session?.user?.username) {
      return session.user.username.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const userName = session?.user?.name || session?.user?.username || "User";

  return (
    <nav className="border-b">
      <div className="flex h-16 items-center px-4 md:px-6">
        <div className="flex items-center gap-6 flex-1">
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left">Asset Tracker</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-8">
                <Link
                  href="/user"
                  className={cn(
                    "text-lg font-medium hover:text-primary transition-colors",
                    isActive("user") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Users
                </Link>
                <Link
                  href="/assets"
                  className={cn(
                    "text-lg font-medium hover:text-primary transition-colors",
                    isActive("assets") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Assets
                </Link>
                <Link
                  href="/accessories"
                  className={cn(
                    "text-lg font-medium hover:text-primary transition-colors",
                    isActive("accessories") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Accessories
                </Link>
                <Separator className="my-2" />
                <p className="text-sm font-semibold text-muted-foreground">More Items</p>
                <Link
                  href="/locations"
                  className={cn(
                    "text-base font-medium hover:text-primary transition-colors pl-2",
                    isActive("locations") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Locations
                </Link>
                <Link
                  href="/manufacturers"
                  className={cn(
                    "text-base font-medium hover:text-primary transition-colors pl-2",
                    isActive("manufacturers") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Manufacturers
                </Link>
                <Link
                  href="/suppliers"
                  className={cn(
                    "text-base font-medium hover:text-primary transition-colors pl-2",
                    isActive("suppliers") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Suppliers
                </Link>
                <Link
                  href="/licences"
                  className={cn(
                    "text-base font-medium hover:text-primary transition-colors pl-2",
                    isActive("licences") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Licences
                </Link>
                <Link
                  href="/consumables"
                  className={cn(
                    "text-base font-medium hover:text-primary transition-colors pl-2",
                    isActive("consumables") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Consumables
                </Link>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/" className="hidden sm:block font-bold text-lg">
            Asset Tracker
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex gap-6">
            <Link
              href="/user"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                isActive("user") ? "text-primary" : "text-muted-foreground"
              )}
            >
              Users
            </Link>
            <Link
              href="/assets"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                isActive("assets") ? "text-primary" : "text-muted-foreground"
              )}
            >
              Assets
            </Link>
            <Link
              href="/accessories"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                isActive("accessories") ? "text-primary" : "text-muted-foreground"
              )}
            >
              Accessories
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  Item Menu
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[220px]">
                <DropdownMenuItem asChild>
                  <Link href="/locations">Locations</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/manufacturers">Manufacturer</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/suppliers">Supplier</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/licences">Licences</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/consumables">Consumable</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Global Search Button */}
          <Button
            variant="outline"
            className="hidden md:flex items-center gap-2 text-muted-foreground w-64"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-5 w-5" />
          </Button>

          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <NotificationIcon size={24} />
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  99+
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="py-3">
                <div className="flex flex-row items-center gap-6 justify-between w-full">
                  <span>An asset got assigned</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem className="text-destructive">
                Delete all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeSwitcher />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="https://images.unsplash.com/broken" alt={userName} />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Signed in as</p>
                  <p className="text-xs leading-none text-muted-foreground">{userName}</p>
                  {session?.user?.email && (
                    <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/user/${session?.user?.id || '123'}`}>My Items</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/user/${session?.user?.id || '123'}/settings`}>My Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/user/${session?.user?.id || '123'}/edit`}>Edit Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <SignOutButton />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
