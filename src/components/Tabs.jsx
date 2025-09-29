"use client";
import React from "react";
import { Tabs, Tab, Card, CardBody } from "../../lib/nextui";

const TabsComponent = (props) => {
  return (
    <div className="flex w-full flex-col">
      <Tabs aria-label="Options">
        {props.map((tab) => (
          <Tab key={tab.key} title={tab.title}></Tab>
        ))}
      </Tabs>
    </div>
  );
};

export default TabsComponent;
