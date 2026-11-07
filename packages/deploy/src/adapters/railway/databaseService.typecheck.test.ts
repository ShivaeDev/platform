import { volume } from "railway/iac";
import type { DatabaseServiceConfig } from "#adapters/railway/databaseService.ts";

const disk = volume("postgres-data");

// @ts-expect-error Each app must choose its database limits.
const missingLimits: DatabaseServiceConfig = { volume: disk };

const missingCpu: DatabaseServiceConfig = {
	// @ts-expect-error Each app must choose its CPU limit.
	limits: { memoryBytes: 536_870_912 },
	volume: disk,
};

const missingMemory: DatabaseServiceConfig = {
	// @ts-expect-error Each app must choose its memory limit.
	limits: { cpu: 1 },
	volume: disk,
};

void [missingLimits, missingCpu, missingMemory];
