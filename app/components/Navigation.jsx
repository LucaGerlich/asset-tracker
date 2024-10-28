"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Link,
  Button,
  Input,
  DropdownItem,
  DropdownTrigger,
  Dropdown,
  DropdownMenu,
  DropdownSection,
  Badge,
  Avatar,
} from "@nextui-org/react";
import {
  ChevronDown,
  Lock,
  Activity,
  Flash,
  Server,
  NotificationIcon,
  TagUser,
  Scale,
} from "../ui/Icons.jsx";
import { usePathname } from "next/navigation";
import ThemeSwitcher from "./ThemeSwitcher.jsx";

function Navigation({ userName }) {
  const route = usePathname();
  const [activeMenu, setActiveMenu] = useState("");

  useEffect(() => {
    // This effect updates the activeMenu state whenever the route changes
    const routeSegment = route.split("/")[1]; // Gets the first segment after the first '/'
    setActiveMenu(routeSegment);
  }, [route]);

  const isActive = (path) => {
    // This function checks if the path is the active menu
    return activeMenu === path;
  };

  const icons = {
    chevron: <ChevronDown fill="currentColor" size={16} />,
    scale: <Scale className="text-warning" fill="currentColor" size={30} />,
    lock: <Lock className="text-success" fill="currentColor" size={30} />,
    activity: (
      <Activity className="text-secondary" fill="currentColor" size={30} />
    ),
    flash: <Flash className="text-primary" fill="currentColor" size={30} />,
    server: <Server className="text-success" fill="currentColor" size={30} />,
    user: <TagUser className="text-danger" fill="currentColor" size={30} />,
  };

  return (
    <Navbar>
      <NavbarContent justify="start">
        <NavbarBrand className="mr-4">
          <Link href="/">
            <span className="hidden sm:block font-bold text-inherit">
              Asset Tracker
            </span>
          </Link>
          {/* <AcmeLogo /> */}
        </NavbarBrand>
        <NavbarContent className="hidden sm:flex gap-3">
          <NavbarItem isActive={isActive("user")}>
            <Link
              href="/user"
              aria-current="page"
              color={isActive("user") ? "primary" : "foreground"}
            >
              Users
            </Link>
          </NavbarItem>
          <NavbarItem isActive={isActive("assets")}>
            <Link
              href="/assets"
              aria-current="page"
              color={isActive("assets") ? "primary" : "foreground"}
            >
              Assets
            </Link>
          </NavbarItem>
          <NavbarItem isActive={isActive("accessories")}>
            <Link
              href="/accessories"
              aria-current="page"
              color={isActive("accessories") ? "primary" : "foreground"}
            >
              Accessories
            </Link>
          </NavbarItem>
          <Dropdown>
            <NavbarItem>
              <DropdownTrigger>
                <Button
                  disableRipple
                  className="p-0 bg-transparent data-[hover=true]:bg-transparent"
                  endContent={icons.chevron}
                  radius="sm"
                  variant="light"
                >
                  Item Menu
                </Button>
              </DropdownTrigger>
            </NavbarItem>
            <DropdownMenu
              aria-label="Other catergories"
              className="w-[220px]"
              itemClasses={{
                base: "gap-4",
              }}
            >
              <DropdownItem
                key="autoscaling"
                //startContent={icons.scale}
                href="/locations"
              >
                Locations
              </DropdownItem>
              <DropdownItem
                key="usage_metrics"
                //startContent={icons.activity}
                href="/manufacturers"
              >
                Manufacturer
              </DropdownItem>
              <DropdownItem
                key="production_ready"
                //startContent={icons.flash}
                href="/suppliers"
              >
                Supplier
              </DropdownItem>
              <DropdownItem
                key="99_uptime"
                //startContent={icons.server}
                href="/licences"
              >
                Licences
              </DropdownItem>
              <DropdownItem
                key="supreme_support"
                //startContent={icons.user}
                href="/consumables"
              >
                Consumable
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarContent>
      </NavbarContent>

      <NavbarContent as="div" className="items-center" justify="end">
        <Dropdown backdrop="blur" showArrow size="lg">
          <Badge
            content="99+"
            shape="rectangle"
            color="danger"
            placement="top-right"
          >
            <DropdownTrigger>
              <Button
                radius="full"
                isIconOnly
                aria-label="more than 99 notifications"
                variant="light"
              >
                <NotificationIcon size={24} />
              </Button>
            </DropdownTrigger>
          </Badge>
          <DropdownMenu variant="faded" aria-label="Static Actions">
            <DropdownSection title="Notifications">
              {" "}
              <DropdownItem
                key="new"
                disableAnimation
                textValue="test"
                className="border-none"
              >
                <div className="flex flex-row items-center gap-6  justify-between">
                  <span>An asset got assigned</span>
                  {/* <Link onClick={console.log("CLEAR")} color="danger">
                    clear
                  </Link> */}
                </div>
              </DropdownItem>
            </DropdownSection>
            <DropdownSection title="Actions">
              {" "}
              <DropdownItem key="delete" className="text-danger" color="danger">
                Delete all notifications
              </DropdownItem>
            </DropdownSection>
          </DropdownMenu>
        </Dropdown>
        <ThemeSwitcher></ThemeSwitcher>
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Avatar
              //as="button"
              className="transition-transform cursor-pointer"
              color="secondary"
              showFallback
              name="Luca Gerlich"
              size="md"
              src="https://images.unsplash.com/broken"
            />
          </DropdownTrigger>
          <DropdownMenu aria-label="Profile Actions" variant="flat">
            <DropdownItem
              href={"/user/123/edit"}
              key="profile"
              textValue="profile"
              className="h-14 gap-2"
            >
              <p className="font-semibold">Signed in as</p>
              <p className="font-semibold">{userName}</p>
            </DropdownItem>
            <DropdownItem href={"/user/123"} key="items" textValue="items">
              My Items
            </DropdownItem>
            <DropdownItem
              href={"/user/123/settings"}
              key="settings"
              textValue="settings"
            >
              My Settings
            </DropdownItem>
            <DropdownItem key="logout" color="danger" textValue="logout">
              Log Out
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarContent>
    </Navbar>
  );
}

export default Navigation;
