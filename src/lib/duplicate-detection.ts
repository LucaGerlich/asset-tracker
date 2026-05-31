/**
 * Duplicate Detection Engine
 *
 * Finds near-duplicate assets using three strategies:
 *   1. Same model + same location  (high confidence)
 *   2. Similar serial numbers       (medium confidence)
 *   3. Similar asset names          (low confidence)
 *
 * Exact duplicates are impossible due to UNIQUE constraints on
 * serialnumber and assettag. This module targets *near* duplicates.
 */

export interface DuplicateAsset {
  assetId: string;
  assetName: string;
  assetTag: string;
  serialNumber: string;
  modelId: string | null;
  locationId: string | null;
  categoryId: string | null;
}

export type DuplicateReason =
  | "same_model_location"
  | "similar_serial"
  | "similar_name";

export type Confidence = "high" | "medium" | "low";

export interface DuplicateGroup {
  reason: DuplicateReason;
  confidence: Confidence;
  assets: DuplicateAsset[];
}

/** Maximum assets to compare per group for O(n^2) strategies. */
const PAIRWISE_LIMIT = 500;

export function detectDuplicates(assets: DuplicateAsset[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];

  groups.push(...findSameModelLocation(assets));
  groups.push(...findSimilarSerials(assets));
  groups.push(...findSimilarNames(assets));

  return groups;
}

function findSameModelLocation(assets: DuplicateAsset[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const buckets = new Map<string, DuplicateAsset[]>();

  for (const asset of assets) {
    if (!asset.modelId || !asset.locationId) continue;
    const key = `${asset.modelId}::${asset.locationId}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(asset);
    } else {
      buckets.set(key, [asset]);
    }
  }

  for (const bucket of buckets.values()) {
    if (bucket.length >= 2) {
      groups.push({
        reason: "same_model_location",
        confidence: "high",
        assets: bucket,
      });
    }
  }

  return groups;
}

function findSimilarSerials(assets: DuplicateAsset[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];

  // Group by model to reduce comparison space
  const byModel = new Map<string, DuplicateAsset[]>();
  for (const asset of assets) {
    if (!asset.serialNumber || asset.serialNumber.length < 6) continue;
    const key = asset.modelId ?? "__no_model__";
    const bucket = byModel.get(key);
    if (bucket) {
      bucket.push(asset);
    } else {
      byModel.set(key, [asset]);
    }
  }

  for (const bucket of byModel.values()) {
    if (bucket.length < 2 || bucket.length > PAIRWISE_LIMIT) continue;

    const seen = new Set<string>();
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i];
        const b = bucket[j];
        const dist = levenshteinDistance(
          a.serialNumber.toLowerCase(),
          b.serialNumber.toLowerCase(),
        );
        if (dist > 0 && dist <= 2) {
          const pairKey = [a.assetId, b.assetId].sort().join("::");
          if (!seen.has(pairKey)) {
            seen.add(pairKey);
            groups.push({
              reason: "similar_serial",
              confidence: "medium",
              assets: [a, b],
            });
          }
        }
      }
    }
  }

  return groups;
}

function findSimilarNames(assets: DuplicateAsset[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];

  // Group by category to reduce comparison space
  const byCat = new Map<string, DuplicateAsset[]>();
  for (const asset of assets) {
    if (!asset.assetName || asset.assetName.length < 8) continue;
    const key = asset.categoryId ?? "__no_cat__";
    const bucket = byCat.get(key);
    if (bucket) {
      bucket.push(asset);
    } else {
      byCat.set(key, [asset]);
    }
  }

  for (const bucket of byCat.values()) {
    if (bucket.length < 2 || bucket.length > PAIRWISE_LIMIT) continue;

    const seen = new Set<string>();
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i];
        const b = bucket[j];
        const nameA = a.assetName.toLowerCase().trim();
        const nameB = b.assetName.toLowerCase().trim();
        const maxLen = Math.max(nameA.length, nameB.length);
        if (maxLen === 0) continue;

        const dist = levenshteinDistance(nameA, nameB);
        const normalized = dist / maxLen;

        if (normalized > 0 && normalized < 0.15) {
          const pairKey = [a.assetId, b.assetId].sort().join("::");
          if (!seen.has(pairKey)) {
            seen.add(pairKey);
            groups.push({
              reason: "similar_name",
              confidence: "low",
              assets: [a, b],
            });
          }
        }
      }
    }
  }

  return groups;
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Use single-row optimization to save memory
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = Array.from<number>({ length: b.length + 1 });

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}
