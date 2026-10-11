import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function freshRerunFixture() {
	const root = mkdtempSync(join(tmpdir(), "platform-fresh-rerun-"));
	const vitest = fileURLToPath(new URL("../../../node_modules/vitest/dist/index.js", import.meta.url));
	const config = join(root, "vitest.config.ts");
	writeFileSync(
		config,
		`export default { root: ${JSON.stringify(root)}, cacheDir: '.ci/vite', test: {
		include: ['*.spec.ts'], coverage: { provider: 'v8', include: ['recovered.ts', 'passing.ts'],
		reporter: ['lcov'], reportOnFailure: true, reportsDirectory: '.ci/coverage' }
	} };`,
	);
	const spec = readFileSync(new URL("./freshRerun.spec.ts.txt", import.meta.url), "utf8").replace("'vitest'", JSON.stringify(vitest));
	writeFileSync(join(root, "fresh.spec.ts"), spec);
	writeFileSync(join(root, "recovered.ts"), "export function recovered() { return 2; }");
	writeFileSync(join(root, "passing.ts"), "export function passing() { return 1; }");
	writeFileSync(
		join(root, "passing.spec.ts"),
		`import { appendFileSync } from 'node:fs';
		import { it, expect } from ${JSON.stringify(vitest)};
		import { passing } from './passing.ts';
		it('passes in another file', () => { appendFileSync('other-passed.txt', 'passed\\n'); expect(passing()).toBe(1); });`,
	);
	mkdirSync(join(root, ".ci"));
	return {
		close: () => rmSync(root, { force: true, recursive: true }),
		read: (path: string) => readFileSync(join(root, path), "utf8"),
		root,
		run(event: string, extra: string[] = [], permanent = false) {
			return spawnSync(
				"env",
				[
					`GITHUB_EVENT_NAME=${event}`,
					`GITHUB_STEP_SUMMARY=${join(root, ".ci/summary.md")}`,
					`PERMANENT_FAILURE=${permanent}`,
					process.execPath,
					"--conditions=source",
					fileURLToPath(new URL("../testShard.ts", import.meta.url)),
					"--config",
					config,
					...extra,
				],
				{
					cwd: root,
					encoding: "utf8",
					timeout: 60_000,
				},
			);
		},
		write: (path: string, contents: string) => writeFileSync(join(root, path), contents),
	};
}
