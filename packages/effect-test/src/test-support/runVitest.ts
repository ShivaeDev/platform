import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface Report {
	readonly testResults: readonly {
		readonly assertionResults: readonly {
			readonly title: string;
			readonly status: string;
			readonly failureMessages: readonly string[];
		}[];
	}[];
}

export function runVitest(fixture: string) {
	const vitestRoot = dirname(createRequire(import.meta.url).resolve("vitest/package.json"));
	const result = spawnSync(
		process.execPath,
		[join(vitestRoot, "vitest.mjs"), "run", "--config", "src/test-support/runner.config.ts", "--configLoader", "native", "--reporter=json", fixture],
		{ cwd: fileURLToPath(new URL("../..", import.meta.url)), encoding: "utf8", timeout: 30_000 },
	);
	if (result.error !== undefined) {
		throw result.error;
	}
	if (result.stdout.trim() === "") {
		throw new Error(`Nested Vitest produced no report: ${result.stderr}`);
	}
	const report: Report = JSON.parse(result.stdout);
	return { status: result.status, tests: report.testResults.flatMap((file) => file.assertionResults) };
}
