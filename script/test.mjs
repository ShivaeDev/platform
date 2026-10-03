import { spawnSync } from "node:child_process";
import { assertLocalDatabase, localServer } from "./local-postgres.mjs";

const env = { ...process.env };
for (const name of ["PRISMA", "SQL", "PG_BOSS", "CHANGES_PRISMA"]) {
	const key = `PLATFORM_EFFECT_${name}_TEST_DATABASE_URL`;
	env[key] ??= env.TEST_DATABASE_URL ?? `${localServer}/platform_test`;
	assertLocalDatabase(env[key], ["platform_test"]);
}
const result = spawnSync(
	"node",
	["packages/heavy-lock/src/cli.ts", "--", "pnpm", "--recursive", "--workspace-concurrency=1", "--if-present", "test", ...process.argv.slice(2)],
	{ env, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
