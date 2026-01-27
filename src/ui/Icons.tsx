"use client";

import React, { ComponentType, SVGProps } from "react";
import {
  Activity as LucideActivity,
  BadgeCheck as LucideBadgeCheck,
  Bell as LucideBell,
  Contact as LucideContact,
  Eye as LucideEye,
  Info as LucideInfo,
  Lock as LucideLock,
  Moon,
  Pencil as LucidePencil,
  Plus as LucidePlus,
  QrCode as LucideQrCode,
  Search as LucideSearch,
  Server as LucideServer,
  Sun,
  Tag as LucideTag,
  Trash2 as LucideTrash2,
  UserPlus as LucideUserPlus,
  Zap as LucideZap,
  ChevronDown as LucideChevronDown,
  MoreVertical as LucideMoreVertical,
  Scale as LucideScale,
  LucideProps,
} from "lucide-react";

const DEFAULT_COLOR = "#18181B"; // Tailwind zinc-900

interface IconProps extends Omit<LucideProps, 'ref'> {
  fill?: string;
  color?: string;
}

const withDefaultIconColor = (IconComponent: ComponentType<LucideProps>) => {
  const WrappedIcon = ({ fill, color, ...props }: IconProps) => (
    <IconComponent color={color ?? fill ?? DEFAULT_COLOR} {...props} />
  );

  WrappedIcon.displayName = `IconWrapper(${IconComponent.displayName || IconComponent.name || "Icon"})`;

  return WrappedIcon;
};

export const DarkModeIcon = withDefaultIconColor(Moon);

export const LightModeIcon = withDefaultIconColor(Sun);

export const AssignIcon = withDefaultIconColor(LucideUserPlus);

export const Info = withDefaultIconColor(LucideInfo);

export const NotificationIcon = withDefaultIconColor(LucideBell);

export const Status = withDefaultIconColor(LucideBadgeCheck);

export const ChevronDown = withDefaultIconColor(LucideChevronDown);

export const ChevronDownIcon = ({ strokeWidth = 1.5, fill, color, ...props }: IconProps & { strokeWidth?: number }) => (
  <LucideChevronDown
    strokeWidth={strokeWidth}
    color={color ?? fill ?? DEFAULT_COLOR}
    {...props}
  />
);

export const VerticalDotsIcon = withDefaultIconColor(LucideMoreVertical);

export const PlusIcon = withDefaultIconColor(LucidePlus);

export const SearchIcon = withDefaultIconColor(LucideSearch);

export const Lock = withDefaultIconColor(LucideLock);

export const Activity = withDefaultIconColor(LucideActivity);

export const Flash = withDefaultIconColor(LucideZap);

export const Server = withDefaultIconColor(LucideServer);

export const TagUser = withDefaultIconColor(LucideContact);

export const Scale = withDefaultIconColor(LucideScale);

export const EditIcon = withDefaultIconColor(LucidePencil);

export const DeleteIcon = withDefaultIconColor(LucideTrash2);

export const EyeIcon = withDefaultIconColor(LucideEye);

export const QrCode = withDefaultIconColor(LucideQrCode);

export const MoreVertical = withDefaultIconColor(LucideMoreVertical);

export const Label = withDefaultIconColor(LucideTag);
