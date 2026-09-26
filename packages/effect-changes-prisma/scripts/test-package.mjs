import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { withTarballOverrides } from "../../../script/packed-workspace.ts";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "effect-changes-prisma-consumer-"));
const tarballs = {
	changes: join(temporaryDirectory, "effect-changes.tgz"),
	prisma: join(temporaryDirectory, "effect-changes-prisma.tgz"),
};

const execute = (command, arguments_, cwd = temporaryDirectory) =>
	execFileSync(command, arguments_, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});

try {
	execute("pnpm", ["pack", "--out", tarballs.changes], join(repositoryRoot, "packages/effect-changes"));
	execute("pnpm", ["pack", "--out", tarballs.prisma], packageRoot);

	const contents = execute("tar", ["-tzf", tarballs.prisma]).trim().split("\n");
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
				name: "effect-changes-prisma-consumer",
				private: true,
				type: "module",
				dependencies: {
					"@shivaedev/effect-changes": `file:${tarballs.changes}`,
					"@shivaedev/effect-changes-prisma": `file:${tarballs.prisma}`,
					"@prisma/client": manifest.devDependencies["@prisma/client"],
					"@types/node": manifest.devDependencies["@types/node"],
					effect: manifest.devDependencies.effect,
				},
			},
			null,
			2,
		)}\n`,
	);
	await writeFile(
		join(temporaryDirectory, "pnpm-workspace.yaml"),
		withTarballOverrides(await readFile(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8"), { "@shivaedev/effect-changes": tarballs.changes }),
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
		`import { Effect } from "effect"
import { type ChangeMap, checkCoverage, makePrismaChanges, type PrismaError, tablesOf, type TransactionExpired } from "@shivaedev/effect-changes-prisma"

interface OrderRow { readonly id: string; readonly ownerId: string }
interface OrderDelegate {
  readonly [key: symbol]: { readonly types: { readonly payload: { readonly name: "Order"; readonly scalars: OrderRow } } }
  create(args: { readonly data: OrderRow }): Promise<OrderRow>
}
interface Client {
  readonly order: OrderDelegate
  $transaction<X>(run: (tx: Client) => Promise<X>): Promise<X>
}

const rows: Array<OrderRow> = []
const order: OrderDelegate = { create: async ({ data }) => (rows.push(data), data) }
const client: Client = { order, $transaction: (run) => run(client) }

interface Change { readonly subject: string }
const models = { Order: (row) => [{ subject: row.ownerId }] } satisfies ChangeMap<Client, Change>
const published: Array<string> = []
const changes = makePrismaChanges({ name: "Consumer", client, models, publish: (batch: ReadonlyArray<Change>) => Effect.sync(() => published.push(...batch.map((change) => change.subject))) })

const saved: Effect.Effect<OrderRow, TransactionExpired | PrismaError> = changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada" } })).pipe(changes.transaction)
await Effect.runPromise(saved)
if (published.join() !== "ada" || rows.length !== 1) throw new Error("the packed binding did not publish after commit")
const violations = checkCoverage({ written: ["order"], tables: tablesOf("model Order {\\n  id String @id\\n  @@map(\\"order\\")\\n}"), models, observations: [], unnamed: [], covers: () => true })
if (violations.length !== 1) throw new Error("the packed coverage check did not report the unrecorded table")
`,
	);

	execute("pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false", "--store-dir", join(repositoryRoot, ".pnpm-store")]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.nodenext.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc6"), ["--project", "tsconfig.json"]);
	execute("node", ["--experimental-strip-types", "index.ts"]);
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
