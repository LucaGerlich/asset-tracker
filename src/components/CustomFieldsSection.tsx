"use client";

import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CustomField {
  id: string;
  name: string;
  fieldType: string;
  options: string | null;
  isRequired: boolean;
  displayOrder: number;
  value: string | null;
}

interface CustomFieldsSectionProps {
  entityType: string;
  entityId: string | null;
  onChange?: (values: Record<string, string | null>) => void;
  readOnly?: boolean;
}

export default function CustomFieldsSection({
  entityType,
  entityId,
  onChange,
  readOnly = false,
}: CustomFieldsSectionProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  const fetchFields = useCallback(async () => {
    try {
      const params = new URLSearchParams({ entityType });
      if (entityId) params.set("entityId", entityId);
      const res = await fetch(`/api/custom-fields/values?${params}`);
      if (res.ok) {
        const data: CustomField[] = await res.json();
        setFields(data);
        const initialValues: Record<string, string | null> = {};
        for (const field of data) {
          initialValues[field.id] = field.value;
        }
        setValues(initialValues);
      }
    } catch {
      // Custom fields are optional
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const handleChange = (fieldId: string, value: string | null) => {
    const newValues = { ...values, [fieldId]: value };
    setValues(newValues);
    onChange?.(newValues);
  };

  if (loading) {
    return null;
  }

  if (fields.length === 0) {
    return null;
  }

  return (
    <section className="border-default-200 rounded-lg border p-4">
      <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
        Custom Fields
      </h2>
      <div className="grid grid-cols-1 gap-3">
        {fields.map((field) => {
          const fieldValue = values[field.id] ?? "";

          if (readOnly) {
            return (
              <div key={field.id} className="flex justify-between text-sm">
                <span className="text-foreground-500">{field.name}</span>
                <span className="font-medium">
                  {field.fieldType === "checkbox"
                    ? fieldValue === "true"
                      ? "Yes"
                      : "No"
                    : fieldValue || "-"}
                </span>
              </div>
            );
          }

          return (
            <div key={field.id}>
              <Label htmlFor={`cf-${field.id}`}>
                {field.name}
                {field.isRequired && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>
              {renderFieldInput(field, fieldValue, handleChange)}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function renderFieldInput(
  field: CustomField,
  value: string,
  handleChange: (fieldId: string, value: string | null) => void,
) {
  switch (field.fieldType) {
    case "text":
      return (
        <Input
          id={`cf-${field.id}`}
          value={value}
          onChange={(e) => handleChange(field.id, e.target.value)}
          required={field.isRequired}
        />
      );
    case "textarea":
      return (
        <Textarea
          id={`cf-${field.id}`}
          value={value}
          onChange={(e) => handleChange(field.id, e.target.value)}
          rows={2}
          required={field.isRequired}
        />
      );
    case "number":
      return (
        <Input
          id={`cf-${field.id}`}
          type="number"
          value={value}
          onChange={(e) => handleChange(field.id, e.target.value)}
          required={field.isRequired}
        />
      );
    case "date":
      return (
        <Input
          id={`cf-${field.id}`}
          type="date"
          value={value}
          onChange={(e) => handleChange(field.id, e.target.value)}
          required={field.isRequired}
        />
      );
    case "select": {
      let options: string[] = [];
      try {
        options = field.options ? JSON.parse(field.options) : [];
      } catch {
        options = field.options
          ? field.options.split(",").map((o) => o.trim())
          : [];
      }
      return (
        <Select value={value} onValueChange={(v) => handleChange(field.id, v)}>
          <SelectTrigger id={`cf-${field.id}`}>
            <SelectValue placeholder={`Select ${field.name}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "multiselect": {
      let options: string[] = [];
      try {
        options = field.options ? JSON.parse(field.options) : [];
      } catch {
        options = field.options
          ? field.options.split(",").map((o) => o.trim())
          : [];
      }
      const selectedValues = value ? value.split(",").map((v) => v.trim()) : [];
      return (
        <div className="mt-1 space-y-1.5">
          {options.map((opt) => (
            <div key={opt} className="flex items-center space-x-2">
              <Checkbox
                id={`cf-${field.id}-${opt}`}
                checked={selectedValues.includes(opt)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...selectedValues, opt]
                    : selectedValues.filter((v) => v !== opt);
                  handleChange(
                    field.id,
                    next.length > 0 ? next.join(", ") : null,
                  );
                }}
              />
              <Label
                htmlFor={`cf-${field.id}-${opt}`}
                className="text-sm font-normal"
              >
                {opt}
              </Label>
            </div>
          ))}
        </div>
      );
    }
    case "checkbox":
      return (
        <div className="mt-1 flex items-center space-x-2">
          <Checkbox
            id={`cf-${field.id}`}
            checked={value === "true"}
            onCheckedChange={(checked) =>
              handleChange(field.id, checked ? "true" : "false")
            }
          />
          <Label htmlFor={`cf-${field.id}`} className="text-sm font-normal">
            {field.name}
          </Label>
        </div>
      );
    case "url":
      return (
        <Input
          id={`cf-${field.id}`}
          type="url"
          placeholder="https://..."
          value={value}
          onChange={(e) => handleChange(field.id, e.target.value)}
          required={field.isRequired}
        />
      );
    case "email":
      return (
        <Input
          id={`cf-${field.id}`}
          type="email"
          value={value}
          onChange={(e) => handleChange(field.id, e.target.value)}
          required={field.isRequired}
        />
      );
    case "currency":
      return (
        <div className="relative">
          <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
            $
          </span>
          <Input
            id={`cf-${field.id}`}
            type="number"
            step="0.01"
            className="pl-7"
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            required={field.isRequired}
          />
        </div>
      );
    case "color":
      return (
        <div className="flex items-center gap-2">
          <Input
            id={`cf-${field.id}`}
            type="color"
            className="h-9 w-12 cursor-pointer p-1"
            value={value || "#000000"}
            onChange={(e) => handleChange(field.id, e.target.value)}
            required={field.isRequired}
          />
          <span className="text-muted-foreground text-sm">
            {value || "#000000"}
          </span>
        </div>
      );
    default:
      return (
        <Input
          id={`cf-${field.id}`}
          value={value}
          onChange={(e) => handleChange(field.id, e.target.value)}
        />
      );
  }
}
