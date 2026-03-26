export interface SearchableField {
  key: string;
  label: string;
  type: "text" | "number" | "date";
  /** If true, this is a custom field and key is the custom_field_definitions.id */
  isCustom?: boolean;
}

export type SearchableEntity =
  | "asset"
  | "accessory"
  | "consumable"
  | "licence"
  | "component";

export const ENTITY_LABELS: Record<SearchableEntity, string> = {
  asset: "Asset",
  accessory: "Accessory",
  consumable: "Consumable",
  licence: "Licence",
  component: "Component",
};

/** Primary key column per entity (used for linking to detail pages). */
export const ENTITY_ID_FIELD: Record<SearchableEntity, string> = {
  asset: "assetid",
  accessory: "accessorieid",
  consumable: "consumableid",
  licence: "licenceid",
  component: "id",
};

/** Name column per entity (used for display in results). */
export const ENTITY_NAME_FIELD: Record<SearchableEntity, string> = {
  asset: "assetname",
  accessory: "accessoriename",
  consumable: "consumablename",
  licence: "licencekey",
  component: "name",
};

/** Detail page path template. `{id}` is replaced with the entity ID. */
export const ENTITY_DETAIL_PATH: Record<SearchableEntity, string> = {
  asset: "/assets/{id}",
  accessory: "/accessories/{id}",
  consumable: "/consumables/{id}",
  licence: "/licences/{id}",
  component: "/components/{id}",
};

export const SEARCHABLE_FIELDS: Record<SearchableEntity, SearchableField[]> = {
  asset: [
    { key: "assetname", label: "Name", type: "text" },
    { key: "assettag", label: "Tag", type: "text" },
    { key: "serialnumber", label: "Serial Number", type: "text" },
    { key: "purchaseprice", label: "Purchase Price", type: "number" },
    { key: "creation_date", label: "Created", type: "date" },
    { key: "warrantyExpires", label: "Warranty Expires", type: "date" },
    { key: "purchasedate", label: "Purchase Date", type: "date" },
    { key: "specs", label: "Specs", type: "text" },
    { key: "notes", label: "Notes", type: "text" },
  ],
  accessory: [
    { key: "accessoriename", label: "Name", type: "text" },
    { key: "accessorietag", label: "Tag", type: "text" },
    { key: "purchaseprice", label: "Purchase Price", type: "number" },
    { key: "purchasedate", label: "Purchase Date", type: "date" },
    { key: "creation_date", label: "Created", type: "date" },
  ],
  consumable: [
    { key: "consumablename", label: "Name", type: "text" },
    { key: "purchaseprice", label: "Purchase Price", type: "number" },
    { key: "purchasedate", label: "Purchase Date", type: "date" },
    { key: "quantity", label: "Quantity", type: "number" },
    { key: "minQuantity", label: "Min Quantity", type: "number" },
    { key: "creation_date", label: "Created", type: "date" },
  ],
  licence: [
    { key: "licencekey", label: "Licence Key", type: "text" },
    { key: "licensedtoemail", label: "Licensed To Email", type: "text" },
    { key: "purchaseprice", label: "Purchase Price", type: "number" },
    { key: "purchasedate", label: "Purchase Date", type: "date" },
    { key: "expirationdate", label: "Expiration Date", type: "date" },
    { key: "seatCount", label: "Seat Count", type: "number" },
    { key: "creation_date", label: "Created", type: "date" },
    { key: "notes", label: "Notes", type: "text" },
  ],
  component: [
    { key: "name", label: "Name", type: "text" },
    { key: "serialNumber", label: "Serial Number", type: "text" },
    { key: "totalQuantity", label: "Total Quantity", type: "number" },
    { key: "remainingQuantity", label: "Remaining Quantity", type: "number" },
    { key: "purchasePrice", label: "Purchase Price", type: "number" },
    { key: "purchaseDate", label: "Purchase Date", type: "date" },
    { key: "minQuantity", label: "Min Quantity", type: "number" },
    { key: "createdAt", label: "Created", type: "date" },
  ],
};

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains";

export interface SearchFilter {
  field: string;
  op: FilterOperator;
  value: string;
  isCustom?: boolean;
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "equals",
  neq: "not equals",
  gt: "greater than",
  lt: "less than",
  gte: "greater than or equal",
  lte: "less than or equal",
  contains: "contains",
};

/** Map entity type strings from custom_field_definitions.entityType to our SearchableEntity */
export const CUSTOM_FIELD_ENTITY_MAP: Record<string, SearchableEntity> = {
  asset: "asset",
  accessory: "accessory",
  consumable: "consumable",
  licence: "licence",
  component: "component",
};
