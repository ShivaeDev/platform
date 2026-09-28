import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "quality-consumer-"));
const tarball = join(temporaryDirectory, "quality.tgz");

const execute = (command, arguments_, cwd = temporaryDirectory) =>
	execFileSync(command, arguments_, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});

const quality = (...arguments_) =>
	spawnSync(join(temporaryDirectory, "node_modules/.bin/quality"), arguments_, { cwd: temporaryDirectory, encoding: "utf8" });

const expectRun = (arguments_, status, output) => {
	const result = quality(...arguments_);
	const printed = `${result.stdout}${result.stderr}`;
	if (result.status !== status || !printed.includes(output)) {
		throw new Error(`quality ${arguments_.join(" ")} exited ${result.status} (expected ${status}) without "${output}":\n${printed}`);
	}
};

const writeJson = (path, value) => writeFile(join(temporaryDirectory, path), `${JSON.stringify(value, null, 2)}\n`);

const source = (path, content) => writeFile(join(temporaryDirectory, path), content);

try {
	execute("pnpm", ["pack", "--out", tarball], packageRoot);

	const contents = execute("tar", ["-tzf", tarball]).trim().split("\n");
	for (const required of [
		"package/dist/cli.js",
		"package/dist/index.js",
		"package/dist/index.d.ts",
		"package/dist/index.d.ts.map",
		"package/src/index.ts",
		"package/CHANGELOG.md",
		"package/README.md",
	]) {
		if (!contents.includes(required)) {
			throw new Error(`Packed package is missing ${required}`);
		}
	}
	if (contents.some((path) => path.startsWith("package/test/"))) {
		throw new Error("Packed package unexpectedly contains its test suite");
	}
	const packedManifest = JSON.parse(execute("tar", ["-xOzf", tarball, "package/package.json"]));
	if (
		packedManifest.bin?.quality !== "./dist/cli.js" ||
		JSON.stringify([packedManifest.dependencies, packedManifest.peerDependencies]).includes("catalog:")
	) {
		throw new Error("Packed manifest must expose the quality bin and pin its dependencies");
	}

	const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
	await writeJson("package.json", {
		name: "quality-consumer",
		private: true,
		type: "module",
		dependencies: {
			"@shivaedev/quality": `file:${tarball}`,
			"@types/node": manifest.devDependencies["@types/node"],
			...packedManifest.peerDependencies,
		},
	});
	// A consumer has none of this repository's overrides; keeping them would hide how the package resolves on its own.
	const workspace = await readFile(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8");
	await writeFile(join(temporaryDirectory, "pnpm-workspace.yaml"), workspace.replace(/^overrides:\n(?:(?:[ \t].*)?\n)*/m, ""));
	const compilerOptions = {
		lib: ["ESNext"],
		module: "ESNext",
		moduleResolution: "Bundler",
		noEmit: true,
		skipLibCheck: true,
		strict: true,
		target: "ESNext",
		types: ["node"],
		verbatimModuleSyntax: true,
	};
	await writeJson("tsconfig.json", { compilerOptions, include: ["quality.config.ts", "typing.ts"] });
	await writeJson("tsconfig.nodenext.json", { extends: "./tsconfig.json", compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" } });
	await source(
		"quality.config.ts",
		`import { Effect, Schema } from "effect"
import { defineConfig, defineRule } from "@shivaedev/quality"

const Marker = Schema.Struct({ marker: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed("TODO"))) })

const noTodo = defineRule({
  id: "local/no-todo",
  description: "Resolve markers before merging.",
  options: Schema.toStandardSchemaV1(Marker),
  check: ({ options, sources }) =>
    sources.flatMap((file) =>
      file.lines.flatMap((text, index) =>
        text.includes(options.marker) ? [{ file: file.path, line: index + 1, message: "Resolve this " + options.marker + "." }] : []),
    ),
})

export default defineConfig({
  local: [noTodo],
  rules: { "structure/max-lines": { options: { source: 3 } }, "local/no-todo": { options: { marker: "FIXME" } } },
  sources: ["src"],
})
`,
	);
	await source(
		"typing.ts",
		`import { defineConfig } from "@shivaedev/quality"

export const typed = defineConfig({
  // @ts-expect-error Built-in rule options stay typed through the packed declarations.
  rules: { "structure/max-lines": { options: { source: "many" } } },
})
`,
	);
	await mkdir(join(temporaryDirectory, "src"));
	await source("src/long.ts", "export const a = 1\nexport const b = 2\nexport const c = 3\nexport const d = 4\n");
	await source("src/marked.ts", "// FIXME: split this\nexport const e = 5\n");

	execute("pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false", "--store-dir", join(repositoryRoot, ".pnpm-store")]);
	const installed = await readdir(join(temporaryDirectory, "node_modules/.pnpm"));
	for (const name of ["effect", "@effect/platform-node-shared"]) {
		const prefix = `${name.replace("/", "+")}@`;
		const copies = installed.filter((entry) => entry.startsWith(prefix)).map((entry) => entry.split("_")[0]);
		if (copies.join() !== `${prefix}${packedManifest.peerDependencies[name]}`) {
			throw new Error(`Consumer must hold one ${name} copy at the peer version, found: ${copies.join(", ")}`);
		}
	}
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.nodenext.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc6"), ["--project", "tsconfig.json"]);

	expectRun(["lint"], 1, "error local/no-todo (1)\n  Resolve markers before merging.\n  src/marked.ts:1  Resolve this FIXME.");
	expectRun(["lint"], 1, "src/long.ts  4 lines exceeds the 3-line limit.");
	expectRun(["baseline", "write"], 0, "recorded 2 entries in quality/baseline.json");
	expectRun(["lint"], 0, "quality: passed");
	await source("src/marked.ts", "export const e = 5\n");
	expectRun(["lint"], 1, "local/no-todo src/marked.ts has no violations left.");
	expectRun(["baseline", "prune"], 0, "removed 1 entry");
	expectRun(["lint"], 0, "1 baselined violation not shown");
	await source("quality.config.ts", `export default { rules: { "structure/max-lines": { options: { sorce: 3 } } } }\n`);
	expectRun(["lint"], 2, "sorce");
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
