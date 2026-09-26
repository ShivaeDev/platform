import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "effect-react-consumer-"));
const tarball = join(temporaryDirectory, "effect-react.tgz");
const formTarball = join(temporaryDirectory, "effect-form.tgz");

const execute = (command, arguments_, cwd = temporaryDirectory) =>
	execFileSync(command, arguments_, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});

try {
	execute("pnpm", ["pack", "--out", formTarball], join(repositoryRoot, "packages/effect-form"));
	execute("pnpm", ["pack", "--out", tarball], packageRoot);

	const contents = execute("tar", ["-tzf", tarball]).trim().split("\n");
	for (const required of [
		"package/dist/index.js",
		"package/dist/index.d.ts",
		"package/dist/index.d.ts.map",
		"package/src/index.ts",
		"package/dist/form.js",
		"package/dist/form.d.ts",
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

	const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
	const consumer = async (dependencies, include) => {
		await writeFile(
			join(temporaryDirectory, "package.json"),
			`${JSON.stringify({ name: "effect-react-consumer", private: true, type: "module", dependencies }, null, 2)}\n`,
		);
		await writeFile(
			join(temporaryDirectory, "tsconfig.json"),
			`${JSON.stringify(
				{
					compilerOptions: {
						lib: ["ESNext"],
						module: "ESNext",
						moduleResolution: "Bundler",
						noEmit: true,
						skipLibCheck: true,
						strict: true,
						target: "ESNext",
						types: ["node"],
						verbatimModuleSyntax: true,
					},
					include,
				},
				null,
				2,
			)}\n`,
		);
		execute("pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false", "--store-dir", join(repositoryRoot, ".pnpm-store")]);
		execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.json"]);
		execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.nodenext.json"]);
		execute(join(packageRoot, "node_modules/.bin/tsc6"), ["--project", "tsconfig.json"]);
	};
	const consumed = async (source, target, entry) =>
		writeFile(join(temporaryDirectory, target), (await readFile(join(packageRoot, source), "utf8")).replace(/"\.\.\/src\/[a-z]+\.ts"/, `"${entry}"`));

	await writeFile(join(temporaryDirectory, "pnpm-workspace.yaml"), await readFile(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8"));
	await writeFile(
		join(temporaryDirectory, "tsconfig.nodenext.json"),
		`${JSON.stringify({ extends: "./tsconfig.json", compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" } }, null, 2)}\n`,
	);
	await consumed("test/hooks.typecheck.ts", "index.ts", "@shivaedev/effect-react");
	await consumed("test/form.typecheck.ts", "form.ts", "@shivaedev/effect-react/form");

	const withoutForm = {
		"@effect/atom-react": manifest.devDependencies["@effect/atom-react"],
		"@types/react": manifest.devDependencies["@types/react"],
		react: manifest.devDependencies.react,
		"@shivaedev/effect-react": `file:${tarball}`,
		"@types/node": manifest.devDependencies["@types/node"],
		effect: manifest.devDependencies.effect,
	};
	await consumer(withoutForm, ["index.ts"]);
	execute("node", ["--input-type=module", "--eval", "await import('@shivaedev/effect-react')"]);

	await consumer({ ...withoutForm, "@shivaedev/effect-form": `file:${formTarball}` }, ["index.ts", "form.ts"]);
	execute("node", ["--input-type=module", "--eval", "await import('@shivaedev/effect-react'); await import('@shivaedev/effect-react/form')"]);
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
