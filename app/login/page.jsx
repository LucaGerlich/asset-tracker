"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Input, Card, CardBody, CardHeader } from "@nextui-org/react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      identifier,
      password,
      redirect: true,
      callbackUrl,
    });
    // When redirect=true, NextAuth will navigate; no need to handle res here.
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto mt-12">
      <Card>
        <CardHeader className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-default-500">
            Use your email or username and password
          </p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email or Username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error ? (
              <p className="text-danger text-sm">{error}</p>
            ) : null}
            <Button color="primary" type="submit" isLoading={loading}>
              Sign In
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
