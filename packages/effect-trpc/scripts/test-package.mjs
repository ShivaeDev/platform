import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(
	join(tmpdir(), "effect-trpc-consumer-"),
);
const tarball = join(temporaryDirectory, "effect-trpc.tgz");

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
		"package/dist/testing.js",
		"package/dist/testing.d.ts",
		"package/dist/testing.d.ts.map",
		"package/src/index.ts",
		"package/src/testing.ts",
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
				name: "effect-trpc-consumer",
				private: true,
				type: "module",
				dependencies: {
					"@effect/vitest": manifest.devDependencies["@effect/vitest"],
					"@shivaedev/effect-trpc": `file:${tarball}`,
					"@trpc/server": manifest.devDependencies["@trpc/server"],
					"@types/node": manifest.devDependencies["@types/node"],
					effect: manifest.devDependencies.effect,
					vitest: manifest.devDependencies.vitest,
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
					lib: ["ESNext", "DOM", "DOM.Iterable"],
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
		`import { initTRPC } from "@trpc/server"
import { Context, Layer, ManagedRuntime, Schema } from "effect"
import { makeEffectTRPC, makeRequestServices } from "@shivaedev/effect-trpc"
import { makeTrpcIt } from "@shivaedev/effect-trpc/testing"

class RuntimeValue extends Context.Service<RuntimeValue, number>()("@consumer/RuntimeValue") {}
class RequestValue extends Context.Service<RequestValue, string>()("@consumer/RequestValue") {}

interface RequestContext {
  readonly requestId: string
}

const runtime = ManagedRuntime.make(Layer.succeed(RuntimeValue, 1))
const adapter = makeEffectTRPC({ runtime })
const t = initTRPC.context<RequestContext>().create()
const requestServices = makeRequestServices((context: RequestContext) =>
  Layer.succeed(RequestValue, context.requestId),
)
const procedure = adapter.procedure(t.procedure, requestServices)
const router = t.router({
  transformed: procedure
    .input(Schema.Struct({ value: Schema.NumberFromString }))
    .output(Schema.NumberFromString)
    .query(function* (input) {
      const runtimeValue = yield* RuntimeValue
      const requestValue = yield* RequestValue
      return String(input.value + runtimeValue + requestValue.length)
    }),
})

const caller = router.createCaller({ requestId: "typed" })
const result: Promise<number> = caller.transformed({ value: "2" })
void result

const it = makeTrpcIt({
  adapter,
  createCaller: (context = { requestId: "default" }) => router.createCaller(context),
  layer: Layer.succeed(RuntimeValue, 2),
})

it.effectTRPC("retains packed caller types", function* (trpc) {
  const value: number = yield* trpc.transformed({ value: "3" })
  void value

  // @ts-expect-error Encoded input remains a string through the packed package.
  yield* trpc.transformed({ value: 3 })
  // @ts-expect-error Unknown procedures remain rejected through the packed package.
  yield* trpc.missing()
})
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
		"await import('@shivaedev/effect-trpc'); await import('@shivaedev/effect-trpc/testing')",
	]);
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
