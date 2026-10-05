import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { test as it } from "node:test";
import { V8CoverageProvider } from "@vitest/coverage-v8/dist/provider.js";
import { createVitest } from "vitest/node";
import workspace from "#test/vitest.config.ts";

const files = {
	"existing/src/index.test.ts": "export const checked = true;\n",
	"existing/src/index.ts": "export const value = 42;\n",
	"existing/src/types.d.ts": "export declare const value: number;\n",
	"future/src/index.ts": "export const value = 42;\n",
	"future/src/test-support/fixture.ts": "export const fixture = 1;\n",
	"future/src/test-support/generated/client.ts": "export const client = 1;\n",
	"future/src/value.spec.ts": "export const checked = true;\n",
	"other/src/index.ts": "export const value = 42;\n",
};

it("coverage includes never-imported package source and leaves out declarations, tests and test support", async () => {
	const root = realpathSync(mkdtempSync(join(tmpdir(), "platform-coverage-")));
	try {
		for (const [path, content] of Object.entries(files)) {
			mkdirSync(dirname(join(root, "packages", path)), { recursive: true });
			writeFileSync(join(root, "packages", path), content);
		}
		const { coverage } = (await workspace()).test;
		const context = await createVitest("test", {
			config: false,
			coverage: {
				...coverage,
				enabled: true,
				include: coverage.include.map((pattern) => pattern.replace(process.cwd(), root)),
				reportsDirectory: join(root, "coverage"),
			},
			project: ["*:unit"],
			projects: ["existing", "other"].map((name) => ({ root: join(root, "packages", name), test: { name: `${name}:unit` } })),
			root,
		});
		try {
			const provider = new V8CoverageProvider();
			provider.initialize(context);
			const report = await provider.generateCoverage({ allTestsRun: true });
			const reported = report
				.files()
				.map((path: string) => path.slice(join(root, "packages").length + 1))
				.toSorted();
			assert.deepEqual(reported, ["existing/src/index.ts", "future/src/index.ts", "other/src/index.ts"]);
			assert.equal(report.fileCoverageFor(join(root, "packages", "future", "src", "index.ts")).toSummary().lines.pct, 0);
		} finally {
			await context.close();
		}
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
