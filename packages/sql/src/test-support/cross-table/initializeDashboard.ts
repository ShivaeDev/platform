import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { DashboardConfig } from "./DashboardConfig.ts";

export const initializeDashboard = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tables = yield* DashboardConfig;
	return { sql, tables };
});
