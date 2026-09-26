import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { checkBrowserEntries } from "#package-check/browser.ts";
import { consumerDependencies } from "#package-check/dependencies.ts";
import { checkEffectCopies } from "#package-check/effect-copies.ts";
import { writeFixtures } from "#package-check/fixtures.ts";
import { command, requireThat, writeJson } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";
import type { Scenario } from "#package-check/scenarios.ts";
import { withTarballOverrides } from "#packed-workspace.ts";

const compilerOptions = {
	lib: ["ESNext", "DOM", "DOM.Iterable"],
	module: "ESNext",
	moduleResolution: "Bundler",
	noEmit: true,
	skipLibCheck: true,
	strict: true,
	target: "ESNext",
	types: ["node"],
	verbatimModuleSyntax: true,
	resolveJsonModule: true,
	exactOptionalPropertyTypes: true,
	noUncheckedIndexedAccess: true,
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
			name: "packed-consumer",
			private: true,
			type: "module",
			dependencies,
			scripts: {
				typecheck: "tsc --project tsconfig.json",
				"typecheck:nodenext": "tsc --project tsconfig.nodenext.json",
				"typecheck:compat": "tsc6 --project tsconfig.json",
			},
		});
		yield* fs.writeFileString(
			join(consumer, "pnpm-workspace.yaml"),
			withTarballOverrides(yield* fs.readFileString(join(root, "pnpm-workspace.yaml")), tarballs),
		);
		yield* writeJson(join(consumer, "tsconfig.json"), { compilerOptions, include: ["*.ts"] });
		yield* writeJson(join(consumer, "tsconfig.nodenext.json"), {
			extends: "./tsconfig.json",
			compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" },
		});
		const entries = (
			scenario?.entries ??
			Object.entries(pkg.manifest.exports ?? {})
				.filter(([, target]) => target !== null)
				.map(([key]) => key)
		).map((key) => (key === "." ? pkg.manifest.name : `${pkg.manifest.name}${key.slice(1)}`));
		yield* fs.writeFileString(
			join(consumer, "entries.ts"),
			entries
				.map(
					(entry, i) =>
						`import * as entry${i} from ${JSON.stringify(entry)}${entry.endsWith(".json") ? ' with { type: "json" }' : ""};\nvoid entry${i};`,
				)
				.join("\n"),
		);
		yield* command(consumer, "pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false", "--store-dir", join(root, ".pnpm-store")]);
		yield* checkEffectCopies(consumer, catalog);
		yield* checkBrowserEntries(root, pkg, consumer);
		if (scenario?.omitOptionalPeers) yield* checkOptionalPeers(pkg, consumer);
		for (const script of ["typecheck", "typecheck:nodenext", "typecheck:compat"]) yield* command(consumer, "pnpm", ["run", script]);
		yield* command(consumer, "node", [
			"--input-type=module",
			"--eval",
			entries
				.filter((entry) => !entry.endsWith(".json"))
				.map((entry) => `await import(${JSON.stringify(entry)});`)
				.join("\n"),
		]);
		yield* runFixtures(consumer, scenario?.run ?? []);
	});

const checkOptionalPeers = (pkg: Package, consumer: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		for (const [name, meta] of Object.entries(pkg.manifest.peerDependenciesMeta ?? {}))
			if (meta.optional)
				yield* requireThat(
					!(yield* fs.exists(join(consumer, "node_modules", name))),
					`${pkg.manifest.name}: minimal consumer installed optional peer ${name}`,
				);
	});

const runFixtures = (consumer: string, selected: readonly string[]) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		for (const file of yield* fs.readDirectory(consumer))
			if (file.startsWith("runtime-") || selected.includes(file)) yield* command(consumer, "node", [file]);
	});
