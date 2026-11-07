import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Effect, FileSystem } from "effect";
import { packTemplate } from "@shivaedev/create-app/packTemplate.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { command, writeJson } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";
import { generateStarter } from "#starter-published/generate.ts";
import { runStarter } from "#starter-published/run.ts";
import { pinRegistry } from "#starter-published/test-support/pinRegistry.ts";

const NAME = "@fixture/local-postgres";

export const pinnedApp = storyKit({
	after: {
		*source(engine) {
			const fs = yield* FileSystem.FileSystem;
			const registry = yield* pinRegistry(engine.root, engine.peer);
			const starter = join(engine.root, "examples/starter");
			yield* fs.writeFileString(
				join(starter, "pnpm-workspace.copy.yaml"),
				`packages: []\nregistry: ${registry}\ncatalog:\n  "${NAME}": ${engine.pin}\n  effect: 4.1.1\n`,
			);
			yield* writeJson(join(starter, "published-versions.json"), { [NAME]: engine.pin });
			yield* writeJson(join(engine.pkg.directory, "package.json"), engine.pkg.manifest);
			yield* command(engine.pkg.directory, "pnpm", ["pack", "--out", engine.pkg.tarball]);
			yield* packTemplate(starter, join(engine.generator, "template.json"));
			const archive = join(engine.root, "create-app.tgz");
			yield* command(engine.generator, "pnpm", ["pack", "--out", archive]);
			engine.packages = [
				engine.pkg,
				{ directory: engine.generator, manifest: { name: "@shivaedev/create-app", version: "1.0.0" }, tarball: archive },
			];
			engine.registry = registry;
		},
	},
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "packed-starter-pins-" });
		const starter = join(root, "examples/starter");
		const generator = join(root, "generator-source");
		const workspace = join(root, "workspace");
		for (const directory of [starter, generator, workspace]) {
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
			dependencies: { [NAME]: "catalog:", effect: "catalog:" },
			devDependencies: {},
			engines: {},
			imports: {},
			name: "fixture",
			packageManager: "pnpm@12.17.0",
			private: true,
			scripts: {
				ci: "pnpm peers check && pnpm run typecheck",
				format: "node -e ''",
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
		return { generator, packages, peer: "4.1.1", pin: "1.0.0", pkg, registry: "", root };
	},
	layer: NodeServices.layer,
	name: "packed starter against npm pins",
	stages: ["source"],
	verbs: (engine, story) => ({
		check: Effect.fn("PinnedApp.check")(function* () {
			story.tell("Packed starter generates and installs the app, then runs its CI");
			return yield* Effect.gen(function* () {
				const { folder } = yield* generateStarter(engine.root, engine.root, engine.packages);
				yield* runStarter(join(engine.root, folder), "postgres://localhost/starter-story");
			}).pipe(
				Effect.provide(ConfigProvider.layerAdd(ConfigProvider.fromUnknown({ "npm_config_registry": engine.registry }))),
				Effect.match({ onFailure: (error) => error.message, onSuccess: () => "passed" }),
			);
		}),
	}),
});

export const effectPeerMismatch = pinnedApp.trait("source", "npm requires Effect 4.1.0 while the starter and workspace require 4.1.1", (engine) =>
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
