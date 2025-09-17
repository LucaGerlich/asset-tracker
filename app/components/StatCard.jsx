"use client";
import React from "react";
import { Card, CardBody, CardHeader } from "@nextui-org/react";

export default function StatCard({ href, title, value }) {
  const Wrapper = href ? "a" : "div";
  return (
    <Wrapper href={href} className="w-full h-28">
      <Card>
        <CardHeader>{title}</CardHeader>
        <CardBody className="text-5xl text-primary">{value}</CardBody>
      </Card>
    </Wrapper>
  );
}

