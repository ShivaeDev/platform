import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "effect-service-consumer-"));
const tarball = join(temporaryDirectory, "effect-service.tgz");

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
				name: "effect-service-consumer",
				private: true,
				type: "module",
				dependencies: {
					"@shivaedev/effect-service": `file:${tarball}`,
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
		`import { Context, Effect, Layer } from "effect"
import { defineService } from "@shivaedev/effect-service"

class Prefix extends Context.Service<Prefix, string>()("@consumer/Prefix") {}
const Greetings = defineService({
  id: "@consumer/Greetings",
  requires: [Prefix],
  initialize: Effect.void,
  methods: () => ({ greet: (name: string) => Effect.map(Prefix, prefix => prefix + name) }),
})
const layer = Greetings.layer.pipe(Layer.provide(Layer.succeed(Prefix, "Hello ")))
const program = Effect.gen(function* () {
  const greetings = yield* Greetings
  const greeting: string = yield* greetings.greet("Ada")
  // @ts-expect-error Arguments remain checked through the packed declarations.
  greetings.greet(42)
  return greeting
}).pipe(Effect.provide(layer))
const runnable: Effect.Effect<string> = program
void runnable
`,
	);

	execute("pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false", "--store-dir", join(repositoryRoot, ".pnpm-store")]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.nodenext.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc6"), ["--project", "tsconfig.json"]);
	execute("node", [
		"--input-type=module",
		"--eval",
		`const { defineService } = await import('@shivaedev/effect-service');
const { Effect } = await import('effect');
const Service = defineService({ id: 'packed/Service', requires: [], initialize: Effect.succeed(41), methods: n => ({ next: () => Effect.succeed(n + 1) }) });
const result = await Effect.runPromise(Effect.flatMap(Service, s => s.next()).pipe(Effect.provide(Service.layer)));
if (result !== 42) throw new Error('Packed service did not execute');`,
	]);
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
