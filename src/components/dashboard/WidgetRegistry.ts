export interface WidgetDefinition {
  type: string;
  title: string;
  description: string;
  icon?: string;
  defaultConfig?: Record<string, unknown>;
}

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    type: "stats",
    title: "Stats Overview",
    description: "Key metrics at a glance",
  },
  {
    type: "assetsByStatus",
    title: "Assets by Status",
    description: "Pie chart of asset status distribution",
  },
  {
    type: "recentActivity",
    title: "Recent Activity",
    description: "Latest audit log entries",
  },
  {
    type: "upcomingMaintenance",
    title: "Upcoming Maintenance",
    description: "Next scheduled maintenance tasks",
  },
  {
    type: "expiringLicences",
    title: "Expiring Licences",
    description: "Licences expiring in 90 days",
  },
  {
    type: "costOverview",
    title: "Cost Overview",
    description: "Total asset value breakdown",
  },
  {
    type: "lastEdited",
    title: "Recently Modified",
    description: "Assets updated in the last 24 hours",
    icon: "Clock",
  },
  {
    type: "assetMap",
    title: "Asset Map",
    description: "Map showing asset locations",
  },
];

export const DEFAULT_WIDGETS = [
  { widgetType: "stats", position: 0 },
  { widgetType: "assetsByStatus", position: 1 },
  { widgetType: "recentActivity", position: 2 },
];
