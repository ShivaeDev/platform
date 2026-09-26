import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "effect-changes-consumer-"));
const tarball = join(temporaryDirectory, "effect-changes.tgz");

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
				name: "effect-changes-consumer",
				private: true,
				type: "module",
				dependencies: {
					"@shivaedev/effect-changes": `file:${tarball}`,
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
		`import { Context, Effect } from "effect"
import { type Frame, makeChannel, type Outcome } from "@shivaedev/effect-changes"

class Owner extends Context.Service<Owner, string>()("consumer/Owner") {}
interface Event { readonly subject: string; readonly domain: string }

const channel = makeChannel<Event, Owner>({
  name: "Consumer",
  owner: Effect.service(Owner),
  key: (event) => \`\${event.subject}:\${event.domain}\`,
  publish: (events) => Effect.log(events.length),
})
const recorded: Effect.Effect<void, never, Owner> = channel.record([{ subject: "owner", domain: "memberships" }, { subject: "member", domain: "memberships" }])
const body: Effect.Effect<number, "rejected", Owner> = Effect.as(recorded, 1)
const wrapped: Effect.Effect<number, "rejected", Owner> = channel.within(<X, E, R>(effect: Effect.Effect<X, E, R>) => effect)(body)
const opened: Effect.Effect<Frame, never, Owner> = channel.open
const outcome: Outcome = "rolledBack"
// @ts-expect-error Outcomes are only committed or rolledBack.
const invalid: Outcome = "aborted"
// @ts-expect-error Recorded changes keep the channel's change type.
channel.record([{ subject: "owner" }])
void [wrapped, opened, outcome, invalid]
`,
	);

	execute("pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false", "--store-dir", join(repositoryRoot, ".pnpm-store")]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.nodenext.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc6"), ["--project", "tsconfig.json"]);
	execute("node", [
		"--input-type=module",
		"--eval",
		`const { makeChannel } = await import('@shivaedev/effect-changes');
const { Context, Effect, Exit } = await import('effect');
const Owner = Context.Service('consumer/Owner');
const published = [];
const channel = makeChannel({ name: 'Consumer', owner: Effect.service(Owner), publish: (changes) => Effect.sync(() => published.push(changes)) });
const native = (body) => body;
const run = (effect) => Effect.runPromiseExit(Effect.provideService(effect, Owner, 'main'));
await run(channel.within(native)(Effect.andThen(channel.record(['a', 'b']), channel.record(['a']))));
const failed = await run(channel.within(native)(Effect.andThen(channel.record(['c']), Effect.fail('rejected'))));
if (!Exit.isFailure(failed)) throw new Error('Packed channel swallowed a failure');
if (JSON.stringify(published) !== '[["a","b"]]') throw new Error('Packed channel published ' + JSON.stringify(published));`,
	]);
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
