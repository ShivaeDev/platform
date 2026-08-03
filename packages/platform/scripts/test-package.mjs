import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "platform-consumer-"));
const tarballs = {
	platform: join(temporaryDirectory, "platform.tgz"),
	prisma: join(temporaryDirectory, "effect-prisma.tgz"),
	trpc: join(temporaryDirectory, "effect-trpc.tgz"),
};

const execute = (command, arguments_, cwd = temporaryDirectory) =>
	execFileSync(command, arguments_, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});

try {
	execute(
		"pnpm",
		["pack", "--out", tarballs.prisma],
		join(repositoryRoot, "packages/effect-prisma"),
	);
	execute(
		"pnpm",
		["pack", "--out", tarballs.trpc],
		join(repositoryRoot, "packages/effect-trpc"),
	);
	execute("pnpm", ["pack", "--out", tarballs.platform], packageRoot);

	const contents = execute("tar", ["-tzf", tarballs.platform])
		.trim()
		.split("\n");
	for (const required of [
		"package/dist/better-auth.js",
		"package/dist/better-auth.d.ts",
		"package/dist/runtime.js",
		"package/dist/runtime.d.ts",
		"package/dist/node-http.js",
		"package/dist/node-http.d.ts",
		"package/dist/testing.js",
		"package/dist/testing.d.ts",
		"package/dist/testing.d.ts.map",
		"package/src/testing.ts",
		"package/src/better-auth.ts",
		"package/src/runtime.ts",
		"package/src/node-http.ts",
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
				name: "platform-consumer",
				private: true,
				type: "module",
				dependencies: {
					"@effect/vitest": manifest.devDependencies["@effect/vitest"],
					"@prisma-next/adapter-postgres":
						manifest.devDependencies["@prisma-next/adapter-postgres"],
					"@prisma-next/contract":
						manifest.devDependencies["@prisma-next/contract"],
					"@prisma-next/sql-contract":
						manifest.devDependencies["@prisma-next/sql-contract"],
					"@prisma-next/target-postgres":
						manifest.devDependencies["@prisma-next/target-postgres"],
					"@shivaedev/effect-prisma": `file:${tarballs.prisma}`,
					"@shivaedev/effect-trpc": `file:${tarballs.trpc}`,
					"@shivaedev/platform": `file:${tarballs.platform}`,
					"@trpc/server": manifest.devDependencies["@trpc/server"],
					"@types/node": manifest.devDependencies["@types/node"],
					"better-auth": manifest.devDependencies["better-auth"],
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
					resolveJsonModule: true,
					skipLibCheck: true,
					strict: true,
					target: "ESNext",
					types: ["node"],
					verbatimModuleSyntax: true,
				},
				include: ["index.ts", "contract.d.ts"],
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
	await copyFile(
		join(repositoryRoot, "packages/effect-prisma/test/generated/contract.d.ts"),
		join(temporaryDirectory, "contract.d.ts"),
	);
	await copyFile(
		join(repositoryRoot, "packages/effect-prisma/test/generated/contract.json"),
		join(temporaryDirectory, "contract.json"),
	);
	await writeFile(
		join(temporaryDirectory, "index.ts"),
		`import { makeDatabase } from "@shivaedev/effect-prisma"
import { initTRPC } from "@trpc/server"
import type { BetterAuthOptions } from "better-auth"
import { Effect, Layer, Stream } from "effect"
import { makeEffectTRPC, makeRequestServices } from "@shivaedev/effect-trpc"
import { effectPrismaAdapter } from "@shivaedev/platform/better-auth"
import { makePlatformRuntime } from "@shivaedev/platform/runtime"
import { nodeSubscriptionSignal } from "@shivaedev/platform/node-http"
import { makePlatformIt } from "@shivaedev/platform/testing"
import type { Contract } from "./contract.js"
import contractJson from "./contract.json" with { type: "json" }

const Database = makeDatabase<Contract>("@consumer/Database", { contractJson })
const DatabaseLive = Database.layer({ url: "postgresql://compile-only" })
const runtime = makePlatformRuntime(DatabaseLive)
const disconnect = nodeSubscriptionSignal({ signals: [new AbortController().signal] })
disconnect.dispose()
const adapter = makeEffectTRPC({ runtime })
const authDatabase = effectPrismaAdapter(Database, runtime)({} as BetterAuthOptions)
const t = initTRPC.context<{ readonly actor: string }>().create()
const procedure = adapter.procedure(t.procedure, makeRequestServices(() => Layer.empty))
const router = t.router({
  count: procedure.query(function* () {
    const db = yield* Database
    return yield* db.User.count()
  }),
  counts: procedure.subscription(function* () {
    const db = yield* Database
    return Stream.fromEffect(db.User.count())
  }),
})

const it = makePlatformIt(Database)({
  adapter,
  createCaller: (options = { actor: "default" }) => router.createCaller(options),
  layer: DatabaseLive,
  extend: () => Effect.succeed({ fixture: "typed" as const }),
})

type IsAny<Value> = 0 extends (1 & Value) ? true : false

it.effectApp("retains packed harness types", function* ({ db, fixture, promise, trpc }) {
	const databaseIsAny: IsAny<typeof db> = false
	const fixtureIsAny: IsAny<typeof fixture> = false
	const count: number = yield* trpc.count()
  const users = yield* db.User.where({ email: "typed@example.test" })
  users[0]?.email.toUpperCase()
	fixture.toUpperCase()
	void databaseIsAny
	void fixtureIsAny
	void count
	void promise(() => authDatabase.count({ model: "user" }))

  // @ts-expect-error Unknown procedures remain rejected through the packed package.
  yield* trpc.missing()
	// @ts-expect-error Unknown models remain rejected through the packed package.
	db.Movie
	// @ts-expect-error Application extensions do not widen unknown properties.
	fixture.missing
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
		"await import('@shivaedev/platform/testing')",
	]);
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
