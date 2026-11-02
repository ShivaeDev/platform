import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { planning } from "./planning.ts";

export function timingArtifacts() {
	return planning.trait("workspace", "two shards have final reports, a recovered timeout and a stray duplicate cache entry", ({ workspace }) => {
		function write(path: string, value: unknown) {
			const destination = join(workspace.root, path);
			mkdirSync(dirname(destination), { recursive: true });
			writeFileSync(destination, JSON.stringify(value));
		}
		const file = { projectName: "@shivaedev/skills:unit", relativePath: "packages/skills/src/checkSkills.test.ts" };
		write("test-timings-1/tests.json", { testResults: [{ ...file, durationMs: 31_000, status: "passed" }] });
		write("test-timings-1/tests.attempt-1.json", { testResults: [{ ...file, durationMs: 30_000, status: "failed" }] });
		write("test-timings-1/tests.attempt-2.json", { testResults: [{ ...file, durationMs: 1000, status: "passed" }] });
		write("test-timings-2/tests.json", { testResults: [{ durationMs: 2000, projectName: "quality:unit", relativePath: "steady.test.ts" }] });
		const cache = { projects: { [file.projectName]: { files: { [file.relativePath]: { duration: 1000, failed: false } } } }, version: 1 };
		write("test-timings-1/vite/vitest/cache/results.json", cache);
		write("test-timings-2/vite/vitest/cache/results.json", cache);
	});
}
