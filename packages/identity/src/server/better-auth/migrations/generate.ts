import type { BetterAuthOptions } from "better-auth";
import { Effect } from "effect";
import type { StoredRoleOptions } from "#server/better-auth/adapters/storedRoleOptions.ts";
import { authMigrationSql, betterAuthMigrationPlan } from "#server/better-auth/migrationPlan.ts";

export const generateBetterAuthMigration = Effect.fn("Identity.generateBetterAuthMigration")(function* (
	options: Omit<BetterAuthOptions, "database">,
	role?: StoredRoleOptions,
) {
	const plan = yield* betterAuthMigrationPlan(options, role);
	const sql = authMigrationSql(plan.ddl).replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");
	return `import { Effect } from "effect";\nimport { SqlClient } from "effect/sql";\n\nexport default Effect.gen(function* () {\n\tconst sql = yield* SqlClient.SqlClient;\n\tyield* sql.unsafe(\`${sql}\`);\n});\n`;
});
