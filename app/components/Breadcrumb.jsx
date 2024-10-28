"use client";
import React from "react";
import { Breadcrumbs, BreadcrumbItem } from "../lib/nextui";

const Breadcrumb = ({ options }) => {
  return (
    <Breadcrumbs underline="hover" separator="/">
      {options.map((option) => (
        <BreadcrumbItem key={option.id} href={option.href}>
          {option.label}
        </BreadcrumbItem>
      ))}
    </Breadcrumbs>
  );
};

export default Breadcrumb;
