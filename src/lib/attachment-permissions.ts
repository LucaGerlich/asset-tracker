import type { Permission } from "@/lib/rbac";

export type AttachmentEntityType = "accessory" | "consumable" | "component";

/** Permission required to add, change or remove attachments of an entity. */
export const ATTACHMENT_EDIT_PERMISSION: Record<
  AttachmentEntityType,
  Permission
> = {
  accessory: "accessory:edit",
  consumable: "consumable:edit",
  component: "component:edit",
};
