import type { ClientDatabase } from "#server/ClientDatabase.ts";

export const localInspectionChanges = new WeakMap<ClientDatabase, Set<(schema: string, queue: string) => void>>();
