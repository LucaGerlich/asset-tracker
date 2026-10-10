"use client";

import { get, set, del, keys, clear, createStore } from "idb-keyval";

const offlineStore = createStore("asset-tracker-offline", "mutation-queue");

/** Marks a replayed request so the service worker sends it straight through. */
export const REPLAY_HEADER = "x-offline-replay";

const MAX_RETRIES = 3;

export interface QueuedMutation {
  id: string;
  url: string;
  method: "POST" | "PUT" | "DELETE" | "PATCH";
  headers: Record<string, string>;
  body: string | null;
  timestamp: number;
  retryCount: number;
  /** Who made the change. Only that user's session may replay it. */
  userId: string | null;
  /** `blocked` entries were refused by the server and wait for a decision. */
  status?: "pending" | "blocked";
  lastStatus?: number;
  lastCode?: string;
  lastError?: string;
}

export async function enqueueMutation(
  mutation: Pick<
    QueuedMutation,
    "url" | "method" | "headers" | "body" | "userId"
  >,
): Promise<string> {
  const id = crypto.randomUUID();
  const entry: QueuedMutation = {
    ...mutation,
    id,
    timestamp: Date.now(),
    retryCount: 0,
  };
  await set(id, entry, offlineStore);
  return id;
}

export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const allKeys = await keys(offlineStore);
  const entries: QueuedMutation[] = [];
  for (const key of allKeys) {
    const entry = await get<QueuedMutation>(key, offlineStore);
    if (entry) entries.push(entry);
  }
  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

/** Entries without a recorded owner (older worker, unknown user) belong to nobody. */
function hasOwner(entry: QueuedMutation): boolean {
  return typeof entry.userId === "string";
}

export interface QueueSnapshot {
  /** Changes still waiting to be sent. */
  pendingCount: number;
  /** Changes the server refused, waiting for the user to review them. */
  blocked: QueuedMutation[];
}

/**
 * What the signed-in user can see of the queue: their own entries, plus
 * entries nobody owns. Other users' entries stay untouched and invisible.
 */
export async function getQueueSnapshot(
  currentUserId: string,
): Promise<QueueSnapshot> {
  const visible = (await getPendingMutations()).filter(
    (entry) => !hasOwner(entry) || entry.userId === currentUserId,
  );
  return {
    pendingCount: visible.filter((entry) => entry.status !== "blocked").length,
    blocked: visible.filter((entry) => entry.status === "blocked"),
  };
}

/** Removes a single entry, for example after the user chose to discard it. */
export async function discardMutation(id: string): Promise<void> {
  await del(id, offlineStore);
}

export async function clearOfflineQueue(): Promise<void> {
  await clear(offlineStore);
}

export type ReplayOutcome = "succeeded" | "blocked" | "dropped" | "retry";

/**
 * How a replay response is handled. The mobile sync service
 * (mobile/src/services/sync.ts) follows the same table.
 *
 * - 2xx: the server took it, remove the entry.
 * - 401/403/409/422: the server refused a change that may still matter (session
 *   expired, no permission, locked organization, version conflict). Keep it.
 * - 400/404: the change can never apply (invalid, or its target is gone).
 * - 429 and 5xx: temporary, try again later.
 * - Anything else is unexpected, so it is kept for review as well.
 */
export function classifyReplayStatus(status: number): ReplayOutcome {
  if (status >= 200 && status < 300) return "succeeded";
  if (status === 400 || status === 404) return "dropped";
  if (status === 429 || status >= 500) return "retry";
  return "blocked";
}

export interface ReplaySummary {
  succeeded: number;
  blocked: number;
  dropped: number;
  /** Changes given up on after repeated server errors. */
  failed: number;
}

type ReplayStep = keyof ReplaySummary | "kept" | "stop";

interface Denial {
  code?: string;
  error?: string;
}

async function readDenial(res: Response): Promise<Denial> {
  try {
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null) {
      const { code, error } = body as { code?: unknown; error?: unknown };
      return {
        code: typeof code === "string" ? code : undefined,
        error: typeof error === "string" ? error : undefined,
      };
    }
  } catch {
    // Not JSON (for example an HTML error page).
  }
  return {};
}

function isSameOrigin(url: string): boolean {
  try {
    return (
      new URL(url, window.location.origin).origin === window.location.origin
    );
  } catch {
    return false;
  }
}

async function block(
  mutation: QueuedMutation,
  details: Pick<QueuedMutation, "lastStatus" | "lastCode" | "lastError">,
): Promise<void> {
  await set(
    mutation.id,
    { ...mutation, ...details, status: "blocked" },
    offlineStore,
  );
}

async function replayOne(mutation: QueuedMutation): Promise<ReplayStep> {
  if (!isSameOrigin(mutation.url)) {
    await discardMutation(mutation.id);
    return "dropped";
  }

  let res: Response;
  try {
    res = await fetch(mutation.url, {
      method: mutation.method,
      headers: { ...mutation.headers, [REPLAY_HEADER]: "1" },
      body: mutation.body,
    });
  } catch {
    // Network trouble says nothing about this change. Keep it and stop.
    return "stop";
  }

  switch (classifyReplayStatus(res.status)) {
    case "succeeded":
      await discardMutation(mutation.id);
      return "succeeded";
    case "dropped":
      await discardMutation(mutation.id);
      return "dropped";
    case "blocked": {
      const denial = await readDenial(res);
      await block(mutation, {
        lastStatus: res.status,
        lastCode: denial.code,
        lastError: denial.error ?? `The server answered ${res.status}`,
      });
      return "blocked";
    }
    case "retry": {
      if (res.status === 429) return "stop";
      const retryCount = mutation.retryCount + 1;
      if (retryCount >= MAX_RETRIES) {
        await discardMutation(mutation.id);
        return "failed";
      }
      await set(
        mutation.id,
        { ...mutation, retryCount, lastStatus: res.status },
        offlineStore,
      );
      return "kept";
    }
  }
}

/**
 * Sends the signed-in user's queued changes, oldest first. Entries of other
 * users are never sent, entries nobody owns are held for review, and blocked
 * entries are not retried until the user discards them.
 */
export async function replayQueue(
  currentUserId: string,
): Promise<ReplaySummary> {
  const summary: ReplaySummary = {
    succeeded: 0,
    blocked: 0,
    dropped: 0,
    failed: 0,
  };

  for (const mutation of await getPendingMutations()) {
    if (mutation.status === "blocked") continue;

    if (!hasOwner(mutation)) {
      await block(mutation, {
        lastCode: "unknown_owner",
        lastError: "This change was saved before its owner could be recorded",
      });
      summary.blocked++;
      continue;
    }
    if (mutation.userId !== currentUserId) continue;

    const step = await replayOne(mutation);
    if (step === "stop") break;
    if (step !== "kept") summary[step]++;
  }

  return summary;
}

/** Messages the page sends to the service worker. */
export type ServiceWorkerQueueMessage =
  { type: "SET_USER"; userId: string | null } | { type: "CLEAR_QUEUE" };

/**
 * Posts to the controlling worker, or to the active one when the page is not
 * controlled yet (first visit). Never waits for a worker that does not exist.
 */
export async function postToServiceWorker(
  message: ServiceWorkerQueueMessage,
): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
  try {
    const target =
      navigator.serviceWorker.controller ??
      (await navigator.serviceWorker.getRegistration())?.active;
    target?.postMessage(message);
  } catch {
    // No worker to tell.
  }
}

/**
 * Forgets every queued change and the worker's idea of who is signed in.
 * Call before signing out: queued changes must not outlive their user's session.
 */
export async function clearQueueOnSignOut(): Promise<void> {
  try {
    await clearOfflineQueue();
  } catch {
    // IndexedDB may not be available.
  }
  await postToServiceWorker({ type: "CLEAR_QUEUE" });
}
