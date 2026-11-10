import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Effect, FileSystem, Logger } from "effect";
import { packTemplate } from "@shivaedev/create-app/packTemplate.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { command, writeJson } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";
import { generateStarter } from "#starter-published/generate.ts";
import { runStarter } from "#starter-published/run.ts";
import { pinRegistry } from "#starter-published/test-support/pinRegistry.ts";

const NAME = "@fixture/local-postgres";
const UNRELATED = "@fixture/unrelated";

export const pinnedApp = storyKit({
	after: {
		*source(engine) {
			const fs = yield* FileSystem.FileSystem;
			const registry = yield* pinRegistry(engine.root, engine.peer);
			const starter = join(engine.root, "examples/starter");
			yield* fs.writeFileString(
				join(starter, "pnpm-workspace.copy.yaml"),
				`packages: []\nregistry: ${registry}\ncatalog:\n  "${NAME}": ${engine.pin}\n  "${UNRELATED}": 1.0.0\n  effect: 4.1.1\n`,
			);
			yield* writeJson(join(starter, "published-versions.json"), { [NAME]: engine.pin, [UNRELATED]: "1.0.0" });
			yield* writeJson(join(engine.pkg.directory, "package.json"), engine.pkg.manifest);
			yield* command(engine.pkg.directory, "pnpm", ["pack", "--out", engine.pkg.tarball]);
			yield* writeJson(join(engine.unrelated.directory, "package.json"), { ...engine.unrelated.manifest, description: "built by the pull request" });
			yield* command(engine.unrelated.directory, "pnpm", ["pack", "--out", engine.unrelated.tarball]);
			yield* packTemplate(starter, join(engine.generator, "template.json"));
			const archive = join(engine.root, "create-app.tgz");
			yield* command(engine.generator, "pnpm", ["pack", "--out", archive]);
			engine.packages = [
				engine.pkg,
				engine.unrelated,
				{ directory: engine.generator, manifest: { name: "@shivaedev/create-app", version: "1.0.0" }, tarball: archive },
			];
			engine.registry = registry;
		},
	},
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "packed-starter-pins-" });
		const starter = join(root, "examples/starter");
		const generator = join(root, "packages/create-app");
		const workspace = join(root, "packages/local-postgres");
		const unrelated = join(root, "packages/unrelated");
		for (const directory of [starter, generator, workspace, unrelated]) {
			yield* fs.makeDirectory(directory, { recursive: true });
		}
		yield* fs.symlink(join(process.cwd(), "script"), join(root, "script"));
		yield* writeJson(join(generator, "package.json"), {
			bin: { "create-app": "cli.js" },
			name: "@shivaedev/create-app",
			type: "module",
			version: "1.0.0",
		});
		yield* fs.writeFileString(
			join(generator, "cli.js"),
			`#!/usr/bin/env -S node --conditions=@shivaedev/source
import { createApp } from ${JSON.stringify(join(process.cwd(), "packages/create-app/src/createApp.ts"))};
import { NodeRuntime, NodeServices, NodeCrypto } from ${JSON.stringify(join(process.cwd(), "node_modules/@effect/platform-node/dist/index.js"))};
import { Effect } from ${JSON.stringify(join(process.cwd(), "node_modules/effect/dist/index.js"))};
NodeRuntime.runMain(createApp(process.argv[2], new URL("./template.json", import.meta.url).pathname, { git: false, minimal: false, version: "1.0.0" }).pipe(Effect.provide([NodeServices.layer, NodeCrypto.layerSecureRandom])));
`,
		);
		yield* writeJson(join(starter, "package.json"), {
			dependencies: { [NAME]: "catalog:", [UNRELATED]: "catalog:", effect: "catalog:" },
			devDependencies: {},
			engines: {},
			imports: {},
			name: "fixture",
			packageManager: "pnpm@12.17.0",
			private: true,
			scripts: {
				format: "node -e ''",
				ready: "pnpm peers check && pnpm run typecheck",
				setup: "pnpm install",
				typecheck: `${join(process.cwd(), "node_modules/.bin/tsc")} --noEmit`,
			},
			type: "module",
			version: "0.0.0",
		});
		yield* writeJson(join(starter, "tsconfig.json"), { compilerOptions: { strict: true, types: [] }, include: ["tooling.ts"] });
		yield* fs.writeFileString(
			join(starter, "tooling.ts"),
			`import { assertLocalDatabase } from "${NAME}";\nassertLocalDatabase("postgres://localhost/test", ["test"], ["5432"]);\n`,
		);
		yield* fs.writeFileString(
			join(workspace, "index.d.ts"),
			"export declare function assertLocalDatabase(value: string, names: readonly string[], ports?: readonly string[]): void;\n",
		);
		const pkg: Package = {
			directory: workspace,
			manifest: { name: NAME, peerDependencies: { effect: "4.1.1" }, types: "index.d.ts", version: "1.0.0" },
			tarball: join(root, "workspace.tgz"),
		};
		const packages: Package[] = [];
		const environment: Record<string, string> = {};
		const logs: unknown[] = [];
		return {
			environment,
			folder: "",
			generator,
			logs,
			packages,
			peer: "4.1.1",
			pin: "1.0.0",
			pkg,
			registry: "",
			root,
			unrelated: { directory: unrelated, manifest: { name: UNRELATED, version: "1.0.0" }, tarball: join(root, "unrelated.tgz") } satisfies Package,
		};
	},
	layer: NodeServices.layer,
	name: "packed starter against npm pins",
	stages: ["source"],
	verbs: (engine, story) => ({
		check: Effect.fn("PinnedApp.check")(function* () {
			story.tell("Packed starter generates and installs the app, then runs its CI");
			return yield* Effect.gen(function* () {
				const { folder } = yield* generateStarter(engine.root, engine.root, engine.packages);
				engine.folder = folder;
				yield* runStarter(join(engine.root, folder), "postgres://localhost/starter-story");
			}).pipe(
				Effect.provide(ConfigProvider.layerAdd(ConfigProvider.fromUnknown({ "npm_config_registry": engine.registry }), { asPrimary: true })),
				Effect.provide(ConfigProvider.layerAdd(ConfigProvider.fromUnknown(engine.environment), { asPrimary: true })),
				Effect.provide(Logger.layer([Logger.make(({ message }) => engine.logs.push(message))])),
				Effect.match({ onFailure: (error) => error.message, onSuccess: () => "passed" }),
			);
		}),
		installedUnrelated: Effect.fn("PinnedApp.installedUnrelated")(function* () {
			const fs = yield* FileSystem.FileSystem;
			const manifest = yield* fs.readFileString(join(engine.root, engine.folder, "node_modules", UNRELATED, "package.json"));
			return manifest.includes("built by the pull request") ? "the pull request's archive" : "npm";
		}),
		recordedSources: () =>
			Effect.sync(() =>
				engine.logs
					.flat()
					.map(String)
					.filter((line) => /^Installing \S+ from /u.test(line)),
			),
	}),
});

export const effectPeerMismatch = pinnedApp.trait(
	"source",
	"npm and the pull request require Effect 4.1.0 while the starter requires 4.1.1",
	(engine) =>
		Effect.sync(() => {
			engine.peer = "4.1.0";
			engine.pkg = { ...engine.pkg, manifest: { ...engine.pkg.manifest, peerDependencies: { effect: "4.1.0" } } };
		}),
);
export const effectCatalogUpdate = pinnedApp.trait(
	"source",
	"the pull request moves the Effect peer and the starter to 4.1.1 while npm still requires 4.1.0",
	(engine) =>
		Effect.sync(() => {
			engine.peer = "4.1.0";
		}),
);
export const unreleasedPin = pinnedApp.trait("source", "the starter pins an unreleased version with compatible declarations and peers", (engine) =>
	Effect.sync(() => {
		engine.pin = "1.1.0";
		engine.pkg = { ...engine.pkg, manifest: { ...engine.pkg.manifest, version: "1.1.0" } };
	}),
);
export const pendingChangeset = pinnedApp.trait("source", `.changeset/adapter-ports.md releases ${NAME} as a minor`, function* ({ root }) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.makeDirectory(join(root, ".changeset"));
	yield* fs.writeFileString(
		join(root, ".changeset/adapter-ports.md"),
		`---\n"${NAME}": minor\n---\n\n### Added\n\n- \`assertLocalDatabase\` accepts the allowed ports.\n`,
	);
});
export const hostileRegistryEnvironment = pinnedApp.trait(
	"source",
	"the environment sets npm_config_registry to a registry that refuses every connection",
	(engine) =>
		Effect.sync(() => {
			engine.environment = { "npm_config_registry": "http://127.0.0.1:9" };
		}),
);
export const starterDebt = pinnedApp.trait("source", "the starter's quality-baseline.jsonl records one Quality finding", function* ({ root }) {
	yield* (yield* FileSystem.FileSystem).writeFileString(
		join(root, "examples/starter/quality-baseline.jsonl"),
		'{"path":"tooling.ts","rule":"structure/max-lines","count":1}\n',
	);
});
