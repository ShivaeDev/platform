import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "effect-contract-consumer-"));
const tarball = join(temporaryDirectory, "effect-contract.tgz");

const execute = (command, arguments_, cwd = temporaryDirectory) =>
	execFileSync(command, arguments_, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});

try {
	execute("pnpm", ["pack", "--out", tarball], packageRoot);

	const contents = execute("tar", ["-tzf", tarball]).trim().split("\n");
	for (const required of [
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

	const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
	await writeFile(
		join(temporaryDirectory, "package.json"),
		`${JSON.stringify(
			{
				name: "effect-contract-consumer",
				private: true,
				type: "module",
				dependencies: {
					"@shivaedev/effect-contract": `file:${tarball}`,
					"@types/node": manifest.devDependencies["@types/node"],
					effect: manifest.devDependencies.effect,
				},
			},
			null,
			2,
		)}\n`,
	);
	await writeFile(join(temporaryDirectory, "pnpm-workspace.yaml"), await readFile(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8"));
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
				include: ["index.ts"],
			},
			null,
			2,
		)}\n`,
	);
	await writeFile(
		join(temporaryDirectory, "tsconfig.nodenext.json"),
		`${JSON.stringify(
			{
				extends: "./tsconfig.json",
				compilerOptions: {
					module: "NodeNext",
					moduleResolution: "NodeNext",
				},
			},
			null,
			2,
		)}\n`,
	);
	await writeFile(
		join(temporaryDirectory, "index.ts"),
		`import { Effect, Schema } from "effect"
import { collection, command, contract, fieldRejection, query } from "@shivaedev/effect-contract"

class Missing extends Schema.TaggedError<Missing>()("Missing", {}) {}
const Draft = Schema.Struct({ title: Schema.String })
const notes = collection("notes", Schema.Number)
const Get = query("get", { payload: { id: Schema.Number }, success: Schema.String, rejections: { Missing }, reads: ({ id }) => [notes.item(id)] })
const Rename = command("rename", {
  payload: { id: Schema.Number, title: Schema.String },
  rejections: { Missing, Invalid: fieldRejection(Draft) },
  invalidates: ({ id }) => [notes.item(id)],
})
const Notes = contract("notes", { queries: [Get], commands: [Rename] })
export const handlers = Notes.of({
  "notes.get": ({ id }) => (id === 1 ? Effect.succeed("one") : Get.reject.Missing()),
  "notes.rename": ({ title }) => (title === "" ? Rename.reject.Invalid({ field: "title", message: "Enter a title" }) : Effect.void),
})
// @ts-expect-error Key ids keep the collection's id type through the packed declarations.
notes.item("1")
// @ts-expect-error Field rejections accept only the struct's keys.
Rename.reject.Invalid({ field: "body", message: "" })
`,
	);

	execute("pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false", "--store-dir", join(repositoryRoot, ".pnpm-store")]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.nodenext.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc6"), ["--project", "tsconfig.json"]);
	execute("node", [
		"--input-type=module",
		"--eval",
		`const { collection, contract, invalidationKeys, query } = await import('@shivaedev/effect-contract');
const { Effect, Schema } = await import('effect');
const notes = collection('notes', Schema.Number);
const Notes = contract('notes', { queries: [query('list', { success: Schema.Array(Schema.String), reads: () => [notes.list] })] });
if (!Notes.requests.has('notes.list')) throw new Error('Packed contract did not register its RPC');
if (invalidationKeys([notes.item(1)]).join() !== 'notes:1,notes') throw new Error('Packed keys did not expand');
const handlers = Notes.of({ 'notes.list': () => Effect.succeed([]) });
if (typeof handlers['notes.list'] !== 'function') throw new Error('Packed handlers were not accepted');`,
	]);
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
