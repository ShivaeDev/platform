import type { ClientDatabase } from "#server/ClientDatabase.ts";

export const deferralChanges = new WeakMap<ClientDatabase, () => void>();
