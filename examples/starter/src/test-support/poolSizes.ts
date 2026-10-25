import type { PoolSizes } from "#server/PoolSizes.ts";

export const testPoolSizes = { auth: 1, jobs: 1, sql: 3 } satisfies PoolSizes;
