import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(
	join(tmpdir(), "effect-prisma-consumer-"),
);
const tarball = join(temporaryDirectory, "effect-prisma.tgz");

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
		"package/dist/bin/normalize-contract.js",
		"package/dist/index.js",
		"package/dist/index.d.ts",
		"package/dist/index.d.ts.map",
		"package/dist/sqlite.js",
		"package/dist/sqlite.d.ts",
		"package/dist/sqlite.d.ts.map",
		"package/dist/testing.js",
		"package/dist/testing.d.ts",
		"package/dist/testing.d.ts.map",
		"package/src/index.ts",
		"package/src/bin/normalize-contract.ts",
		"package/src/sqlite.ts",
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
				name: "effect-prisma-consumer",
				private: true,
				type: "module",
				dependencies: {
					"@effect/vitest": manifest.devDependencies["@effect/vitest"],
					"@prisma-next/adapter-postgres":
						manifest.devDependencies["@prisma-next/adapter-postgres"],
					"@prisma-next/adapter-sqlite":
						manifest.devDependencies["@prisma-next/adapter-sqlite"],
					"@prisma-next/contract":
						manifest.dependencies["@prisma-next/contract"],
					"@prisma-next/target-postgres":
						manifest.devDependencies["@prisma-next/target-postgres"],
					"@prisma-next/sql-contract":
						manifest.dependencies["@prisma-next/sql-contract"],
					"@shivaedev/effect-prisma": `file:${tarball}`,
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
		join(repositoryRoot, "pnpm-workspace.yaml"),
		join(temporaryDirectory, "pnpm-workspace.yaml"),
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
		join(temporaryDirectory, "tsconfig.strict.json"),
		`${JSON.stringify(
			{
				extends: "./tsconfig.json",
				compilerOptions: {
					exactOptionalPropertyTypes: true,
					noUncheckedIndexedAccess: true,
				},
				include: ["dist-types.ts", "sqlite-contract.d.ts"],
			},
			null,
			2,
		)}\n`,
	);
	await copyFile(
		join(packageRoot, "test/generated/contract.d.ts"),
		join(temporaryDirectory, "contract.d.ts"),
	);
	await copyFile(
		join(packageRoot, "test/generated/contract.json"),
		join(temporaryDirectory, "contract.json"),
	);
	await copyFile(
		join(packageRoot, "test/sqlite/generated/contract.d.ts"),
		join(temporaryDirectory, "sqlite-contract.d.ts"),
	);
	await copyFile(
		join(packageRoot, "test/sqlite/generated/contract.json"),
		join(temporaryDirectory, "sqlite-contract.json"),
	);
	await writeFile(
		join(temporaryDirectory, "index.ts"),
		`import { Effect } from "effect"
import { makeDatabase } from "@shivaedev/effect-prisma"
import { makeDatabaseIt } from "@shivaedev/effect-prisma/testing"
import type { Contract } from "./contract.js"
import contractJson from "./contract.json" with { type: "json" }

const Database = makeDatabase<Contract>("@consumer/Database", { contractJson })
const it = makeDatabaseIt({
  database: Database,
  layer: Database.layer({ url: "postgresql://compile-only" }),
})

it.effectDB("retains package types", function* (db) {
  const users = yield* db.User.where({ email: "typed@example.test" })
  users[0]?.email.toUpperCase()

  // @ts-expect-error Unknown models stay rejected through the packed package.
  db.Movie
  // @ts-expect-error Filter values stay strongly typed through the packed package.
  db.User.where({ email: 123 })
})

const program = Effect.gen(function* () {
  const db = yield* Database
  return yield* db.User.where({ name: "Ada" })
})
void program
`,
	);
	await writeFile(
		join(temporaryDirectory, "dist-types.ts"),
		`import type { DatabaseRequirement, DatabaseServiceOf, PrismaError } from "@shivaedev/effect-prisma"
import { makeSqliteDatabase } from "@shivaedev/effect-prisma/sqlite"
import type { Effect } from "effect"
import type { Contract } from "./sqlite-contract.js"
import contractJson from "./sqlite-contract.json" with { type: "json" }

const Database = makeSqliteDatabase<Contract>("@consumer/SqliteDatabase", {
  contractJson,
})
type Service = DatabaseServiceOf<typeof Database>
declare const service: Service

// Model keys survive declaration emit as a literal union. If the emitted
// declarations degrade to an index signature this widens to \`string\`.
declare const modelKey: keyof Service
export const exactModelKeys: "Post" | "User" | "transaction" = modelKey

// Consequence of the above for consumers on \`noUncheckedIndexedAccess\`: a model
// is the relation itself, never \`Relation | undefined\`.
export const postRelation: Service["Post"] = service.Post

// The executor requirement stays recoverable from the definition.
declare const requirement: [DatabaseRequirement<typeof Database>] extends [never]
  ? "never"
  : "resolved"
export const resolvedRequirement: "resolved" = requirement

// ... and it is exactly the requirement \`transaction\` adds, which is what lets
// consumers annotate their own write lanes against the database.
export const lane = <A, E, R>(
  program: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | PrismaError, R | DatabaseRequirement<typeof Database>> =>
  service.transaction(program)
`,
	);

	execute("pnpm", [
		"install",
		"--ignore-scripts",
		"--frozen-lockfile=false",
		"--store-dir",
		join(repositoryRoot, ".pnpm-store"),
	]);
	const rawContract = join(temporaryDirectory, "raw-contract.d.ts");
	await writeFile(
		rawContract,
		"export type Row = { readonly createdAt: Timestamp<6> };\n",
	);
	execute(
		join(temporaryDirectory, "node_modules/.bin/effect-prisma-normalize"),
		[rawContract],
	);
	if (
		(await readFile(rawContract, "utf8")) !==
		"export type Row = { readonly createdAt: Date };\n"
	) {
		throw new Error("Packed contract normalizer did not replace Timestamp");
	}
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
	execute(join(packageRoot, "node_modules/.bin/tsc"), [
		"--project",
		"tsconfig.strict.json",
	]);
	execute(join(packageRoot, "node_modules/.bin/tsc6"), [
		"--project",
		"tsconfig.strict.json",
	]);
	execute("node", [
		"--input-type=module",
		"--eval",
		"await import('@shivaedev/effect-prisma'); await import('@shivaedev/effect-prisma/sqlite'); await import('@shivaedev/effect-prisma/testing')",
	]);
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
