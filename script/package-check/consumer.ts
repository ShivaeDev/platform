import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { checkBrowserEntries } from "#package-check/browser.ts";
import { declarationProblems } from "#package-check/declarations.ts";
import { consumerDependencies } from "#package-check/dependencies.ts";
import { checkEffectCopies } from "#package-check/effect-copies.ts";
import { blockedEntries, exportEntries, packedFiles } from "#package-check/exports.ts";
import { writeFixtures } from "#package-check/fixtures.ts";
import { command, requireThat, writeJson } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";
import type { Scenario } from "#package-check/scenarios.ts";
import { consumerWorkspace } from "#package-check/workspace.ts";

const compilerOptions = {
	exactOptionalPropertyTypes: true,
	lib: ["ESNext", "DOM", "DOM.Iterable"],
	module: "ESNext",
	moduleResolution: "Bundler",
	noEmit: true,
	noUncheckedIndexedAccess: true,
	resolveJsonModule: true,
	skipLibCheck: true,
	strict: true,
	target: "ESNext",
	types: ["node"],
	verbatimModuleSyntax: true,
};

export const checkConsumer = (
	root: string,
	pkg: Package,
	packages: readonly Package[],
	catalog: Readonly<Record<string, string>>,
	consumer: string,
	scenario?: Scenario,
) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.makeDirectory(consumer);
		const imports = yield* writeFixtures(root, pkg, consumer, scenario?.fixtures);
		const { dependencies, tarballs } = yield* consumerDependencies(pkg, packages, imports, scenario?.omitOptionalPeers);
		yield* writeJson(join(consumer, "package.json"), {
			dependencies,
			name: "packed-consumer",
			private: true,
			scripts: {
				typecheck: "tsc --project tsconfig.json",
				"typecheck:nodenext": "tsc --project tsconfig.nodenext.json",
			},
			type: "module",
		});
		yield* fs.writeFileString(join(consumer, "pnpm-workspace.yaml"), yield* consumerWorkspace(root, pkg, tarballs));
		yield* writeJson(
			join(consumer, "tsconfig.json"),
			scenario?.tsconfig === undefined
				? { compilerOptions, include: ["*.ts"] }
				: { compilerOptions: { outDir: "dist", types: ["node"] }, extends: scenario.tsconfig, include: ["*.ts"] },
		);
		yield* writeJson(join(consumer, "tsconfig.nodenext.json"), {
			compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" },
			extends: "./tsconfig.json",
		});
		const packed = yield* packedFiles(pkg);
		const exported = exportEntries(pkg.manifest, packed);
		const entries =
			scenario === undefined ? exported : scenario.entries.map((key) => ({ json: false, specifier: `${pkg.manifest.name}${key.slice(1)}` }));
		for (const { specifier } of entries) {
			yield* requireThat(
				exported.some((entry) => entry.specifier === specifier),
				`${pkg.manifest.name}: scenario entry ${specifier} is not exported`,
			);
		}
		yield* fs.writeFileString(
			join(consumer, "entries.ts"),
			entries
				.map(
					(entry, i) =>
						`import * as entry${i} from ${JSON.stringify(entry.specifier)}${entry.json ? ' with { type: "json" }' : ""};\nvoid entry${i};`,
				)
				.join("\n"),
		);
		yield* command(consumer, "pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false", "--store-dir", join(root, ".pnpm-store")]);
		yield* checkEffectCopies(consumer, catalog);
		yield* checkBrowserEntries(root, pkg, consumer);
		if (scenario?.omitOptionalPeers) {
			yield* checkOptionalPeers(pkg, consumer);
		}
		for (const script of ["typecheck", "typecheck:nodenext"]) {
			yield* command(consumer, "pnpm", ["run", script]);
		}
		for (const config of ["tsconfig.json", "tsconfig.nodenext.json"]) {
			const problems = declarationProblems(consumer, config, "entries.ts");
			yield* requireThat(problems.length === 0, `${pkg.manifest.name}: ${problems.join("\n")}`);
		}
		yield* command(consumer, "node", [
			"--input-type=module",
			"--eval",
			entries
				.filter((entry) => !entry.json)
				.map((entry) => `await import(${JSON.stringify(entry.specifier)});`)
				.join("\n"),
		]);
		yield* runFixtures(consumer, scenario?.run ?? []);
		if (scenario === undefined) {
			yield* checkBlockedImport(pkg, consumer, blockedEntries(pkg.manifest, packed));
		}
	});

function checkBlockedImport(pkg: Package, consumer: string, blocked: readonly string[]) {
	return Effect.gen(function* () {
		const [specifier] = blocked;
		if (specifier === undefined) {
			yield* requireThat(
				!Object.values(pkg.manifest.exports ?? {}).includes(null),
				`${pkg.manifest.name}: no packed module sits under a blocked export`,
			);
			return;
		}
		const outcome = yield* command(consumer, "node", ["--input-type=module", "--eval", `await import(${JSON.stringify(specifier)});`]).pipe(
			Effect.match({ onFailure: (error) => error.message, onSuccess: () => "the import succeeded" }),
		);
		yield* requireThat(outcome.includes("ERR_PACKAGE_PATH_NOT_EXPORTED"), `${pkg.manifest.name}: ${specifier} must not be importable: ${outcome}`);
	});
}

const checkOptionalPeers = (pkg: Package, consumer: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		for (const [name, meta] of Object.entries(pkg.manifest.peerDependenciesMeta ?? {})) {
			if (meta.optional) {
				yield* requireThat(
					!(yield* fs.exists(join(consumer, "node_modules", name))),
					`${pkg.manifest.name}: minimal consumer installed optional peer ${name}`,
				);
			}
		}
	});

const runFixtures = (consumer: string, selected: readonly string[]) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const runtime = (yield* fs.readDirectory(consumer)).filter((file) => file.startsWith("runtime-"));
		for (const file of new Set([...runtime, ...selected])) {
			yield* command(consumer, "node", [file]);
		}
	});
