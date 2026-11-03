export type KitEntityType =
  "asset_category" | "accessory" | "licence" | "component";

export interface KitEntityOption {
  id: string;
  label: string;
}

interface KitEntitySource {
  /** Org-scoped list endpoint that returns every row when called without ?page. */
  endpoint: string;
  toOption: (row: Record<string, unknown>) => KitEntityOption | null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Last four characters only: a licence key is a secret, a picker label is not. */
function maskedKey(key: string): string {
  return `key …${key.slice(-4)}`;
}

export const KIT_ENTITY_SOURCES: Record<KitEntityType, KitEntitySource> = {
  asset_category: {
    endpoint: "/api/assetCategory",
    toOption: (row) => {
      const id = text(row.assetcategorytypeid);
      const name = text(row.assetcategorytypename);
      return id && name ? { id, label: name } : null;
    },
  },
  accessory: {
    endpoint: "/api/accessories",
    toOption: (row) => {
      const id = text(row.accessorieid);
      const name = text(row.accessoriename);
      if (!id || !name) return null;
      const tag = text(row.accessorietag);
      return { id, label: tag ? `${name} (${tag})` : name };
    },
  },
  licence: {
    endpoint: "/api/licence",
    toOption: (row) => {
      const id = text(row.licenceid);
      if (!id) return null;
      const key = text(row.licencekey);
      const email = text(row.licensedtoemail);
      const hint = email ?? (key ? maskedKey(key) : id.slice(0, 8));
      return { id, label: `Licence (${hint})` };
    },
  },
  component: {
    endpoint: "/api/components",
    toOption: (row) => {
      const id = text(row.id);
      const name = text(row.name);
      return id && name ? { id, label: name } : null;
    },
  },
};

/** Map an unpaged list response to picker options; drops malformed rows. */
export function toKitEntityOptions(
  type: KitEntityType,
  rows: unknown,
): KitEntityOption[] {
  if (!Array.isArray(rows)) return [];
  const { toOption } = KIT_ENTITY_SOURCES[type];
  return rows
    .filter(
      (row): row is Record<string, unknown> =>
        typeof row === "object" && row !== null,
    )
    .map(toOption)
    .filter((option): option is KitEntityOption => option !== null);
}
