import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(
	join(tmpdir(), "effect-pg-boss-consumer-"),
);
const tarball = join(temporaryDirectory, "effect-pg-boss.tgz");

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

	const manifest = JSON.parse(
		await readFile(join(packageRoot, "package.json"), "utf8"),
	);
	await writeFile(
		join(temporaryDirectory, "package.json"),
		`${JSON.stringify(
			{
				name: "effect-pg-boss-consumer",
				private: true,
				type: "module",
				dependencies: {
					"@shivaedev/effect-pg-boss": `file:${tarball}`,
					"@types/node": manifest.devDependencies["@types/node"],
					effect: manifest.devDependencies.effect,
					"pg-boss": manifest.devDependencies["pg-boss"],
				},
			},
			null,
			2,
		)}\n`,
	);
	await writeFile(
		join(temporaryDirectory, "pnpm-workspace.yaml"),
		await readFile(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8"),
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
		`import { Context, Effect, Schema } from "effect"
import { defineQueue, defineSchedule, makePgBoss } from "@shivaedev/effect-pg-boss"

class Mail extends Context.Service<Mail, { send(id: number): Effect.Effect<void> }>()("@consumer/Mail") {}

const Queue = defineQueue({
  name: "mail",
  schema: Schema.Struct({ id: Schema.NumberFromString }),
})
// @ts-expect-error Durable payloads must be object schemas.
defineQueue({ name: "primitive", schema: Schema.String })
const Cleanup = defineSchedule({ name: "cleanup", cron: "0 * * * *" })
const Jobs = makePgBoss("@consumer/Jobs")
const layer = Jobs.layer({
  connectionString: "postgresql://compile-only",
  jobs: [
    Queue.handle(({ id }) => Effect.flatMap(Mail, (mail) => mail.send(id))),
    Cleanup.run(Effect.void),
  ],
})

const boot = Effect.asVoid(Jobs).pipe(Effect.provide(layer))
// @ts-expect-error Worker dependencies remain required through the packed package.
Effect.runPromise(boot)
Effect.runPromise(boot.pipe(Effect.provideService(Mail, { send: () => Effect.void })))

const program = Effect.gen(function* () {
  const jobs = yield* Jobs
  yield* jobs.enqueue(Queue, { id: 1 })
  // @ts-expect-error Decoded payload fields remain strongly typed.
  yield* jobs.enqueue(Queue, { id: "1" })
})
void program
`,
	);

	execute("pnpm", [
		"install",
		"--ignore-scripts",
		"--frozen-lockfile=false",
		"--store-dir",
		join(repositoryRoot, ".pnpm-store"),
	]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), [
		"--project",
		"tsconfig.json",
	]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), [
		"--project",
		"tsconfig.nodenext.json",
	]);
	execute(join(packageRoot, "node_modules/.bin/tsc6"), [
		"--project",
		"tsconfig.json",
	]);
	execute("node", [
		"--input-type=module",
		"--eval",
		"await import('@shivaedev/effect-pg-boss')",
	]);
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
