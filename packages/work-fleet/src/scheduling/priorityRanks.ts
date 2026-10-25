import type { Priority } from "#policy.ts";

export const priorityRanks: Readonly<Record<Priority, number>> = { high: 1, low: 3, normal: 2, urgent: 0 };
