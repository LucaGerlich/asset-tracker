"use client";
import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const TabsComponent = ({ tabs = [] }) => {
  const first = tabs[0]?.key || "tab1";
  return (
    <Tabs defaultValue={first} className="w-full">
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>
            {t.title}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.key} value={t.key}>
          {t.content || null}
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default TabsComponent;
