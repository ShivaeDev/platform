import { spawnSync } from "node:child_process";
import { testDatabases } from "./test-databases.mjs";

const env = { ...process.env, ...testDatabases() };
const result = spawnSync(
	"node",
	["packages/heavy-lock/src/cli.ts", "--", "pnpm", "--recursive", "--workspace-concurrency=1", "--if-present", "test", ...process.argv.slice(2)],
	{ env, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
