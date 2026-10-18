import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));

export function workspaceCoverage(testFile: string) {
	const reports = mkdtempSync(join(tmpdir(), "platform-coverage-"));
	const result = spawnSync(
		"env",
		[
			"NODE_OPTIONS=--conditions=source",
			process.execPath,
			join(root, "node_modules/vitest/vitest.mjs"),
			"run",
			"--config",
			join(root, "script/test/vitest.config.ts"),
			"--configLoader",
			"native",
			"--coverage",
			"--coverage.reporter=lcov",
			`--coverage.reportsDirectory=${reports}`,
			testFile,
		],
		{ cwd: root, encoding: "utf8", timeout: 120_000 },
	);
	const lcov = result.status === 0 ? readFileSync(join(reports, "lcov.info"), "utf8") : "";
	rmSync(reports, { force: true, recursive: true });
	return {
		hitLines(file: string) {
			const record = lcov.split("end_of_record").find((entry) => entry.includes(`SF:${file}\n`));
			const hits = /^LH:(?<hits>\d+)$/mu.exec(record ?? "")?.groups?.hits;
			return hits === undefined ? undefined : Number(hits);
		},
		output: result.stdout + result.stderr,
		status: result.status,
	};
}
