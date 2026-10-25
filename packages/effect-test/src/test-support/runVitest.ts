import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
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

export function runVitest(fixture: string, reporter?: string) {
	const vitestRoot = dirname(createRequire(import.meta.url).resolve("vitest/package.json"));
	const reportDirectory = mkdtempSync(join(tmpdir(), "effect-test-report-"));
	const reportFile = join(reportDirectory, "report.json");
	const envFile = join(reportDirectory, ".env");
	writeFileSync(envFile, `EFFECT_TEST_SERVER_URL=${join(reportDirectory, "server-url")}\n`);
	try {
		const result = spawnSync(
			process.execPath,
			[
				`--env-file=${envFile}`,
				join(vitestRoot, "vitest.mjs"),
				"run",
				"--config",
				"src/test-support/runner.config.ts",
				"--configLoader",
				"native",
				"--reporter=json",
				`--outputFile.json=${reportFile}`,
				...(reporter === undefined ? [] : [`--reporter=${reporter}`]),
				fixture,
			],
			{
				cwd: fileURLToPath(new URL("../..", import.meta.url)),
				encoding: "utf8",
				timeout: 30_000,
			},
		);
		if (result.error !== undefined) {
			throw result.error;
		}
		if (!existsSync(reportFile)) {
			throw new Error(`Nested Vitest produced no report: ${result.stderr}`);
		}
		const report: Report = JSON.parse(readFileSync(reportFile, "utf8"));
		return { output: result.stdout + result.stderr, status: result.status, tests: report.testResults.flatMap((file) => file.assertionResults) };
	} finally {
		rmSync(reportDirectory, { force: true, recursive: true });
	}
}
