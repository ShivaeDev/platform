import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Effect } from "effect";

export const checkDashboardVersion = Effect.tryPromise(async () => {
	const require = createRequire(import.meta.resolve("@shivaedev/effect-pg-boss/package.json"));
	const boss: { version: string } = require("pg-boss/package.json");
	const dashboard = await readFile(new URL("./server/index.js", import.meta.resolve("@pg-boss/dashboard/handler")), "utf8");
	const bundled = dashboard.match(/\bversion: "(?<version>12\.\d+\.\d+)"/u)?.groups?.version;
	if (bundled !== boss.version) {
		throw new Error(`Dashboard bundles pg-boss ${bundled ?? "unknown"}; the app uses ${boss.version}. Upgrade them together.`);
	}
});
