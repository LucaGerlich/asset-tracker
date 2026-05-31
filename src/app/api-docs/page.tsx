"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, Search, FileJson, ExternalLink } from "lucide-react";

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  tags?: Array<{ name: string; description?: string }>;
  paths: Record<string, Record<string, PathOperation>>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
}

interface PathOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema?: { type?: string };
  }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: unknown }>;
  };
  responses?: Record<
    string,
    { description?: string; content?: Record<string, unknown> }
  >;
  security?: Array<Record<string, string[]>>;
}

const METHOD_COLORS: Record<string, string> = {
  get: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  post: "bg-green-500/10 text-green-700 border-green-500/30",
  put: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  patch: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  delete: "bg-red-500/10 text-red-700 border-red-500/30",
  options: "bg-purple-500/10 text-purple-700 border-purple-500/30",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-bold uppercase ${METHOD_COLORS[method] || "bg-gray-100 text-gray-700"}`}
    >
      {method}
    </span>
  );
}

function EndpointCard({
  path,
  method,
  operation,
}: {
  path: string;
  method: string;
  operation: PathOperation;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="hover:bg-muted/50 flex items-center gap-3 rounded-lg p-3 text-left transition-colors">
          <ChevronRight
            className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          />
          <MethodBadge method={method} />
          <code className="flex-1 font-mono text-sm">{path}</code>
          {operation.summary && (
            <span className="text-muted-foreground hidden max-w-xs truncate text-sm md:inline">
              {operation.summary}
            </span>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-11 space-y-3 pb-4">
          {operation.description && (
            <p className="text-muted-foreground text-sm">
              {operation.description}
            </p>
          )}

          {operation.parameters && operation.parameters.length > 0 && (
            <div>
              <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                Parameters
              </h4>
              <div className="space-y-1">
                {operation.parameters.map((param) => (
                  <div
                    key={`${param.in}-${param.name}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                      {param.name}
                    </code>
                    <Badge variant="outline" className="text-[10px]">
                      {param.in}
                    </Badge>
                    {param.required && (
                      <Badge variant="destructive" className="text-[10px]">
                        required
                      </Badge>
                    )}
                    {param.schema?.type && (
                      <span className="text-muted-foreground text-xs">
                        {param.schema.type}
                      </span>
                    )}
                    {param.description && (
                      <span className="text-muted-foreground text-xs">
                        — {param.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {operation.requestBody && (
            <div>
              <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                Request Body
                {operation.requestBody.required && (
                  <Badge variant="destructive" className="ml-2 text-[10px]">
                    required
                  </Badge>
                )}
              </h4>
              <div className="text-muted-foreground text-xs">
                {Object.keys(operation.requestBody.content || {}).join(", ")}
              </div>
            </div>
          )}

          {operation.responses && (
            <div>
              <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                Responses
              </h4>
              <div className="flex flex-wrap gap-1">
                {Object.entries(operation.responses).map(([code, response]) => (
                  <Badge
                    key={code}
                    variant={code.startsWith("2") ? "default" : "outline"}
                    className="text-[10px]"
                    title={response.description}
                  >
                    {code}
                    {response.description ? ` — ${response.description}` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<OpenAPISpec | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/openapi.json")
      .then((r) => r.json())
      .then((data) => {
        setSpec(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-muted-foreground p-8 text-center">
        Loading API documentation...
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="text-muted-foreground p-8 text-center">
        Failed to load API specification.
      </div>
    );
  }

  // Group endpoints by tag
  const grouped: Record<
    string,
    Array<{ path: string; method: string; operation: PathOperation }>
  > = {};

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (method === "parameters") continue;
      const tag = operation.tags?.[0] || "Other";

      // Apply search filter
      if (search) {
        const q = search.toLowerCase();
        const match =
          path.toLowerCase().includes(q) ||
          method.toLowerCase().includes(q) ||
          (operation.summary || "").toLowerCase().includes(q) ||
          (operation.description || "").toLowerCase().includes(q) ||
          tag.toLowerCase().includes(q);
        if (!match) continue;
      }

      if (!grouped[tag]) grouped[tag] = [];
      grouped[tag].push({ path, method, operation });
    }
  }

  const tagDescriptions = Object.fromEntries(
    (spec.tags || []).map((t) => [t.name, t.description]),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FileJson className="h-6 w-6" />
            {spec.info.title}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {spec.info.description}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline">v{spec.info.version}</Badge>
            <Badge variant="outline">OpenAPI {spec.openapi}</Badge>
          </div>
        </div>
        <a
          href="/openapi.json"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          Raw spec <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search endpoints..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {Object.entries(grouped).map(([tag, endpoints]) => (
        <Card key={tag}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{tag}</CardTitle>
            {tagDescriptions[tag] && (
              <CardDescription>{tagDescriptions[tag]}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y">
              {endpoints.map(({ path, method, operation }) => (
                <EndpointCard
                  key={`${method}-${path}`}
                  path={path}
                  method={method}
                  operation={operation}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {Object.keys(grouped).length === 0 && (
        <p className="text-muted-foreground py-8 text-center">
          No endpoints match your search.
        </p>
      )}
    </div>
  );
}
