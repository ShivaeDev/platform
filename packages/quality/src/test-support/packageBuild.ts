import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { linkPackage, type SeedFile } from "./tree.ts";

interface BuildEngine {
	built: { readonly declarations: Map<string, string>; readonly diagnostics: readonly string[] } | undefined;
	readonly root: string;
}

function writeAll(root: string, files: readonly SeedFile[]): void {
	for (const file of files) {
		mkdirSync(dirname(join(root, file.path)), { recursive: true });
		writeFileSync(join(root, file.path), file.content);
	}
}

function emit(root: string): NonNullable<BuildEngine["built"]> {
	const compiler = join(dirname(createRequire(import.meta.url).resolve("@typescript/native/package.json")), "bin", "tsc");
	const result = spawnSync(process.execPath, [compiler, "--project", "tsconfig.build.json"], { cwd: root, encoding: "utf8" });
	if (result.error !== undefined) {
		throw result.error;
	}
	const dist = join(root, "dist");
	const declarations = new Map(
		readdirSync(dist, { encoding: "utf8", recursive: true })
			.filter((name) => name.endsWith(".d.ts"))
			.map((name) => [name, readFileSync(join(dist, name), "utf8")]),
	);
	return { declarations, diagnostics: result.status === 0 ? [] : [result.stdout, result.stderr, `tsc exited ${result.status}`] };
}

function built(engine: BuildEngine): NonNullable<BuildEngine["built"]> {
	if (engine.built === undefined) {
		throw new Error("Build the package before reading what it emitted");
	}
	return engine.built;
}

export const packageBuild = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.sync((): BuildEngine => ({ built: undefined, root: mkdtempSync(join(tmpdir(), "quality-build-")) })),
			(engine) => Effect.sync(() => rmSync(engine.root, { force: true, recursive: true })),
		),
	inspect: (engine) => ({
		declarations: engine.built === undefined ? undefined : [...engine.built.declarations.keys()],
		diagnostics: engine.built?.diagnostics,
	}),
	name: "Quality package build",
	stages: ["package"],
	verbs: (engine, story) => ({
		builds: () =>
			Effect.sync(() => {
				story.tell("the supported TypeScript 7 CLI builds the package and emits its declarations with tsconfig.build.json");
				engine.built = emit(engine.root);
			}),
		declaration: (path: string) => Effect.sync(() => built(engine).declarations.get(path)),
		diagnostics: () => Effect.sync(() => built(engine).diagnostics),
	}),
});

export function packageExtendsQualityConfig() {
	return packageBuild.trait(
		"package",
		"the package maps #*.ts to its sources and builds src/ to dist/ with a tsconfig.build.json that extends quality's package config",
		(engine) => {
			writeAll(engine.root, [
				{
					content: JSON.stringify({
						imports: { "#*.ts": { default: "./dist/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" } },
						name: "@demo/build",
						type: "module",
					}),
					path: "package.json",
				},
				{
					content: JSON.stringify({
						compilerOptions: { customConditions: ["source"], outDir: "dist", rootDir: "src", types: [] },
						extends: "@shivaedev/quality/tsconfig/package.json",
						include: ["src"],
					}),
					path: "tsconfig.build.json",
				},
			]);
			linkPackage(engine.root);
		},
	);
}

export function packageHas(...files: readonly SeedFile[]) {
	return packageBuild.trait("package", `the package contains ${files.map((file) => file.path).join(", ")}`, (engine) => writeAll(engine.root, files));
}
