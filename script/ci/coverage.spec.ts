import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { it } from "node:test";
import { V8CoverageProvider } from "@vitest/coverage-v8/dist/provider.js";
import { createVitest } from "vitest/node";
import workspace from "#test/vitest.config.ts";

it("coverage includes never-imported source in future packages without tests, excluding declarations", async () => {
	const root = mkdtempSync(join(tmpdir(), "platform-coverage-"));
	try {
		for (const name of ["existing", "future"]) {
			mkdirSync(join(root, "packages", name, "src"), { recursive: true });
			writeFileSync(join(root, "packages", name, "src", "index.ts"), "export const value = 42;\n");
			writeFileSync(join(root, "packages", name, "src", "types.d.ts"), "export declare const value: number;\n");
		}
		const { coverage } = (await workspace()).test;
		const context = await createVitest("test", {
			config: false,
			coverage: {
				...coverage,
				enabled: true,
				include: coverage.include.map((pattern) => pattern.replace(`${process.cwd()}/`, `${root}/`)),
				reportsDirectory: join(root, "coverage"),
			},
			project: ["unit"],
			projects: [{ root: join(root, "packages", "existing"), test: { name: "unit" } }],
			root,
		});
		try {
			const provider = new V8CoverageProvider();
			provider.initialize(context);
			const report = await provider.generateCoverage({ allTestsRun: true });
			assert.ok(report.files().includes(join(root, "packages", "future", "src", "index.ts")));
			assert.equal(
				report.files().some((path: string) => path.endsWith(".d.ts")),
				false,
			);
			assert.equal(report.fileCoverageFor(join(root, "packages", "future", "src", "index.ts")).toSummary().lines.pct, 0);
		} finally {
			await context.close();
		}
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
