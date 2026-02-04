"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Edit, Info } from "lucide-react";
import { getMethodDisplayName, type DepreciationMethod } from "@/lib/depreciation";

interface DepreciationSettingsTabProps {
  settings: Array<{
    id: string;
    categoryId: string;
    method: string;
    usefulLifeYears: number;
    salvagePercent: unknown;
    assetCategoryType: {
      assetcategorytypeid: string;
      assetcategorytypename: string;
    };
  }>;
}

const DEPRECIATION_METHODS = [
  { id: "straight_line", name: "Straight Line", description: "Equal depreciation each year" },
  { id: "declining_balance", name: "Double Declining Balance", description: "More depreciation in early years" },
  { id: "sum_of_years", name: "Sum of Years Digits", description: "Accelerated based on remaining life" },
];

export default function DepreciationSettingsTab({
  settings: initialSettings,
}: DepreciationSettingsTabProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    method: "straight_line" as DepreciationMethod,
    usefulLifeYears: 5,
    salvagePercent: 10,
  });

  const handleSave = async () => {
    if (!editingId) return;

    try {
      const response = await fetch(`/api/admin/depreciation/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSettings(
          settings.map((s) =>
            s.id === editingId
              ? {
                  ...s,
                  method: formData.method,
                  usefulLifeYears: formData.usefulLifeYears,
                  salvagePercent: formData.salvagePercent,
                }
              : s
          )
        );
        setIsDialogOpen(false);
        toast.success("Depreciation settings updated");
      } else {
        toast.error("Failed to update settings");
      }
    } catch (error) {
      toast.error("Failed to update settings");
    }
  };

  const openEditDialog = (setting: typeof settings[0]) => {
    setEditingId(setting.id);
    setFormData({
      method: setting.method as DepreciationMethod,
      usefulLifeYears: setting.usefulLifeYears,
      salvagePercent: Number(setting.salvagePercent),
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Depreciation Methods</CardTitle>
          <CardDescription>
            Configure how asset values depreciate over time for each category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {DEPRECIATION_METHODS.map((method) => (
              <div
                key={method.id}
                className="p-4 border rounded-lg"
              >
                <h4 className="font-medium">{method.name}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {method.description}
                </p>
              </div>
            ))}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Useful Life</TableHead>
                <TableHead>Salvage Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((setting) => (
                <TableRow key={setting.id}>
                  <TableCell className="font-medium">
                    {setting.assetCategoryType.assetcategorytypename}
                  </TableCell>
                  <TableCell>
                    {getMethodDisplayName(setting.method as DepreciationMethod)}
                  </TableCell>
                  <TableCell>{setting.usefulLifeYears} years</TableCell>
                  <TableCell>{Number(setting.salvagePercent)}%</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(setting)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {settings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-muted-foreground">
                      No depreciation settings configured. Add asset categories first.
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Understanding Depreciation Methods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium">Straight Line</h4>
            <p className="text-sm text-muted-foreground">
              The most common method. Depreciation is spread evenly across the useful life.
              Formula: (Cost - Salvage Value) / Useful Life Years
            </p>
          </div>
          <div>
            <h4 className="font-medium">Double Declining Balance</h4>
            <p className="text-sm text-muted-foreground">
              Accelerated method that depreciates more in early years. Good for assets that lose
              value quickly. Rate is double the straight-line rate applied to remaining book value.
            </p>
          </div>
          <div>
            <h4 className="font-medium">Sum of Years Digits</h4>
            <p className="text-sm text-muted-foreground">
              Another accelerated method. Depreciation is based on a declining fraction where the
              numerator is the remaining useful life and denominator is the sum of all years.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Depreciation Settings</DialogTitle>
            <DialogDescription>
              Configure depreciation parameters for this asset category
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Depreciation Method</Label>
              <Select
                value={formData.method}
                onValueChange={(value) =>
                  setFormData({ ...formData, method: value as DepreciationMethod })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPRECIATION_METHODS.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Useful Life (Years)</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={formData.usefulLifeYears}
                onChange={(e) =>
                  setFormData({ ...formData, usefulLifeYears: parseInt(e.target.value) || 1 })
                }
              />
              <p className="text-sm text-muted-foreground">
                How many years until the asset reaches its salvage value
              </p>
            </div>

            <div className="space-y-2">
              <Label>Salvage Value (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={formData.salvagePercent}
                onChange={(e) =>
                  setFormData({ ...formData, salvagePercent: parseFloat(e.target.value) || 0 })
                }
              />
              <p className="text-sm text-muted-foreground">
                Percentage of original value at end of useful life (typically 5-15%)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
