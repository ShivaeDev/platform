import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { projectConfig, projectFiles } from "./projectFiles.ts";

const load = createRequire(import.meta.url);
const vitestRoot = dirname(realpathSync(load.resolve("vitest/package.json")));

interface Report {
	readonly testResults: readonly { readonly name: string; readonly status: string }[];
}

interface FileCoverage {
	readonly f: Readonly<Record<string, number>>;
	readonly path: string;
}

function repository(): string {
	const root = mkdtempSync(join(tmpdir(), "quality-projects-"));
	for (const file of projectFiles) {
		const target = join(root, file.path);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, file.content);
	}
	mkdirSync(join(root, "node_modules/@shivaedev"), { recursive: true });
	for (const name of ["vitest", "@vitest/coverage-v8"]) {
		const target = join(root, "node_modules", name);
		mkdirSync(dirname(target), { recursive: true });
		symlinkSync(dirname(realpathSync(load.resolve(`${name}/package.json`))), target, "dir");
	}
	symlinkSync(dirname(realpathSync(load.resolve("@shivaedev/test-story/package.json"))), join(root, "node_modules/@shivaedev/test-story"), "dir");
	return root;
}

function run(root: string, args: readonly string[]) {
	const result = spawnSync(
		"env",
		[
			"NODE_OPTIONS=--conditions=source",
			process.execPath,
			join(vitestRoot, "vitest.mjs"),
			"run",
			"--reporter=default",
			"--reporter=json",
			"--outputFile=report.json",
			...args,
		],
		{
			cwd: root,
			encoding: "utf8",
			timeout: 50_000,
		},
	);
	const report = join(root, "report.json");
	const failures = result.status !== 0 && existsSync(report) ? readFileSync(report, "utf8") : "";
	return { output: `${result.stdout}${result.stderr}${failures}`, status: result.status };
}

export const projectKit = storyKit({
	clock: "live",
	create: () => Effect.acquireRelease(Effect.sync(repository), (root) => Effect.sync(() => rmSync(root, { force: true, recursive: true }))),
	name: "test projects",
	stages: ["configured"],
	verbs: (root, story) => ({
		coverageFiles: () => {
			const report: Record<string, FileCoverage> = JSON.parse(readFileSync(join(root, "coverage/coverage-final.json"), "utf8"));
			return Object.values(report)
				.map((file) => ({ hits: Object.values(file.f), path: file.path.slice(realpathSync(root).length + 1) }))
				.sort((a, b) => a.path.localeCompare(b.path));
		},
		hasCoverage: () => existsSync(join(root, "coverage")),
		run: (...args: readonly string[]) =>
			Effect.sync(() => {
				story.tell(`run vitest ${args.join(" ")}`.trim());
				return run(root, args);
			}),
		testResults: () => {
			const report: Report = JSON.parse(readFileSync(join(root, "report.json"), "utf8"));
			return report.testResults.map((file) => `${file.name.slice(realpathSync(root).length + 1)} ${file.status}`).sort();
		},
	}),
});

export const collectingCoverage = projectKit.trait("configured", "coverage is enabled through the shared helper", (root) => {
	writeFileSync(join(root, "vitest.config.ts"), projectConfig("{ coverage: true }").content);
});

export const customCoverage = projectKit.trait("configured", "native coverage options select one source file", (root) => {
	writeFileSync(join(root, "vitest.config.ts"), projectConfig('{ coverage: { include: ["src/double.ts"], reporter: ["json"] } }').content);
});

export const nodeOnly = projectKit.trait("configured", "only Node specs are installed, without the DOM plugin", (root) => {
	for (const path of ["src/host.dom.spec.tsx", "src/document.dom.test.tsx", "node_modules/@shivaedev/test-story"]) {
		rmSync(join(root, path));
	}
});

export const withWorktrees = projectKit.trait("configured", "a spec sits beside copies in worktree folders", (root) => {
	rmSync(join(root, "src"), { recursive: true });
	rmSync(join(root, "e2e"), { recursive: true });
	for (const path of ["src/b.spec.ts", ".worktrees/copy/src/a.spec.ts", ".worktrees/copy/src/a.dom.spec.ts", ".worktrees/copy/src/a.slow.spec.ts"]) {
		const target = join(root, path);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, 'import { it } from "vitest";\nit("runs", () => {});\n');
	}
});

export function withUnitIo(source: string) {
	return projectKit.trait("configured", "a unit file reaches I/O", (root) => {
		writeFileSync(join(root, "src/io.unit.test.ts"), `import { it } from "vitest";\n${source}\n`);
		const external = join(root, "node_modules/hidden-io");
		mkdirSync(external, { recursive: true });
		writeFileSync(join(external, "package.json"), '{ "type": "module", "exports": "./index.js" }');
		writeFileSync(join(external, "index.js"), 'import { readFileSync } from "node:fs"; export const read = () => readFileSync("package.json");');
	});
}
