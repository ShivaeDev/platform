import { modelTableColumns } from "#storage/modelTables.ts";

// PostgreSQL text cannot distinguish scalar strings from serialized JSON.
export const legacyColumns = {
	...modelTableColumns,
	completedAt: "number",
	integrationRetry: "json",
	pendingAnswers: "json",
	releaseReason: "string",
	stageEnteredAt: "number",
	updatedAt: "number",
} as const;
