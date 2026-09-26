import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { withTarballOverrides } from "../../../script/packed-workspace.ts";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "effect-sql-consumer-"));
const tarballs = {
	changes: join(temporaryDirectory, "effect-changes.tgz"),
	sql: join(temporaryDirectory, "effect-sql.tgz"),
};

const execute = (command, arguments_, cwd = temporaryDirectory) =>
	execFileSync(command, arguments_, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});

try {
	execute("pnpm", ["pack", "--out", tarballs.changes], join(repositoryRoot, "packages/effect-changes"));
	execute("pnpm", ["pack", "--out", tarballs.sql], packageRoot);

	const contents = execute("tar", ["-tzf", tarballs.sql]).trim().split("\n");
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
				name: "effect-sql-consumer",
				private: true,
				type: "module",
				dependencies: {
					"@shivaedev/effect-changes": `file:${tarballs.changes}`,
					"@shivaedev/effect-sql": `file:${tarballs.sql}`,
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
		`import { Effect, Schema } from "effect"
import { Model } from "effect/unstable/schema"
import { invalidateOnCommit, makeRepository, transact } from "@shivaedev/effect-sql"

class InvoiceLine extends Model.Class<InvoiceLine>("InvoiceLine")({
  id: Schema.Number,
  name: Schema.String,
  amount: Schema.NumberFromString,
}) {}

const program = Effect.gen(function* () {
  const lines = yield* makeRepository(InvoiceLine, { tableName: "invoice_line", idColumn: "id", spanPrefix: "InvoiceLine" })
  const selected = yield* lines.findMany({ select: ["name", "amount"], where: { amount: 42 } })
  const rows: Array<{ readonly name: string; readonly amount: number }> = selected
  void rows
  // @ts-expect-error Unselected fields are absent from the result.
  selected[0].id
  // @ts-expect-error Field codecs accept their domain type.
  lines.findMany({ where: { amount: "42" } })
  // @ts-expect-error Unknown selected columns are rejected.
  lines.findMany({ select: ["missing"] })
  // @ts-expect-error Unknown sort columns are rejected.
  lines.findMany({ orderBy: { field: "missing", direction: "asc" } })
  // @ts-expect-error Selections cannot be empty.
  lines.findMany({ select: [] })
  const saved: string = yield* Effect.as(invalidateOnCommit({ invoiceLines: [1] }), "saved").pipe(transact({ onSqlError: () => "unavailable" as const }))
  void saved
})
void program
`,
	);

	execute("pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false", "--store-dir", join(repositoryRoot, ".pnpm-store")]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.nodenext.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc6"), ["--project", "tsconfig.json"]);
	execute("node", ["--input-type=module", "--eval", "await import('@shivaedev/effect-sql')"]);
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
