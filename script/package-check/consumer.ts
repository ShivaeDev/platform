import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { checkBrowserEntries } from "#package-check/browser.ts";
import { declarationProblems } from "#package-check/declarations.ts";
import { consumerDependencies } from "#package-check/dependencies.ts";
import { checkEffectCopies } from "#package-check/effect-copies.ts";
import { writeFixtures } from "#package-check/fixtures.ts";
import { command, requireThat, writeJson } from "#package-check/io.ts";
import { type Package, targets } from "#package-check/model.ts";
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
	store: string,
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
		const entries = (
			scenario?.entries
			?? Object.entries(pkg.manifest.exports ?? {})
				.filter(([, target]) => target !== null)
				.map(([key]) => key)
		).map((key) => ({
			json: targets(pkg.manifest.exports?.[key]).some((target) => target.endsWith(".json")),
			specifier: key === "." ? pkg.manifest.name : `${pkg.manifest.name}${key.slice(1)}`,
		}));
		yield* fs.writeFileString(
			join(consumer, "entries.ts"),
			entries
				.map(
					(entry, i) =>
						`import * as entry${i} from ${JSON.stringify(entry.specifier)}${entry.json ? ' with { type: "json" }' : ""};\nvoid entry${i};`,
				)
				.join("\n"),
		);
		yield* command(consumer, "pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false", "--store-dir", store]);
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
	});

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
