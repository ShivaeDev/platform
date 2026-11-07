import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { planning } from "#ci/test-support/planning.ts";

export function timingArtifacts() {
	return planning.trait("workspace", "two shards have final reports, a recovered timeout and a stray duplicate cache entry", ({ workspace }) => {
		function write(path: string, value: unknown) {
			const destination = join(workspace.root, path);
			mkdirSync(dirname(destination), { recursive: true });
			writeFileSync(destination, typeof value === "string" ? value : JSON.stringify(value));
		}
		const file = { projectName: "@shivaedev/skills:unit", relativePath: "packages/skills/src/checkSkills.test.ts" };
		const classname = `|${file.projectName}| ${file.relativePath}`;
		function junit(time: number, identity: string, failed = false) {
			return `<testsuites><testsuite time="${time}"><testcase classname="${identity}" time="1">${failed ? "<failure />" : ""}</testcase></testsuite></testsuites>`;
		}
		write("test-timings-1/tests.junit.xml", junit(31, classname));
		write("test-timings-1/tests.attempt-1.junit.xml", junit(30, classname, true));
		write("test-timings-1/tests.attempt-2.junit.xml", junit(1, classname));
		write("test-timings-2/tests.junit.xml", junit(2, "|quality:unit| steady.test.ts"));
		write("test-timings-1/tests.json", { testResults: [{ ...file, durationMs: 31_000, status: "passed" }] });
		write("test-timings-1/tests.attempt-1.json", { testResults: [{ ...file, durationMs: 30_000, status: "failed" }] });
		write("test-timings-1/tests.attempt-2.json", { testResults: [{ ...file, durationMs: 1000, status: "passed" }] });
		write("test-timings-2/tests.json", { testResults: [{ durationMs: 2000, projectName: "quality:unit", relativePath: "steady.test.ts" }] });
		const cache = { projects: { [file.projectName]: { files: { [file.relativePath]: { duration: 1000, failed: false } } } }, version: 1 };
		write("test-timings-1/vite/vitest/cache/results.json", cache);
		write("test-timings-2/vite/vitest/cache/results.json", cache);
	});
}
