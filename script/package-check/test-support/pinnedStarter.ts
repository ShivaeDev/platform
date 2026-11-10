import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Effect, FileSystem, Logger } from "effect";
import { FetchHttpClient } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { pinnedTarballs } from "#package-check/adapters/pinnedTarballs.ts";
import { command, writeJson } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";
import { packedInstaller } from "#starter-published/packedInstaller.ts";

const NAME = "@fixture/starter-pin";
const DEPENDENT = "@fixture/starter-dependent";
const GENERATOR = "@shivaedev/create-app";
const HELPER = "@fixture/starter-helper";
const TWO_ARGUMENTS = "export declare function assertLocalDatabase(value: string, names: readonly string[]): void;\n";
const THREE_ARGUMENTS = "export declare function assertLocalDatabase(value: string, names: readonly string[], ports?: readonly string[]): void;\n";

export const pinnedStarter = storyKit({
	after: {
		*release(engine) {
			const fs = yield* FileSystem.FileSystem;
			const { pkg } = engine;
			yield* fs.makeDirectory(join(pkg.directory, "adapters"), { recursive: true });
			yield* fs.writeFileString(join(pkg.directory, `${engine.module}.d.ts`), THREE_ARGUMENTS);
			yield* writeJson(join(pkg.directory, "package.json"), engine.module === "index" ? { ...pkg.manifest, types: "index.d.ts" } : pkg.manifest);
			yield* command(pkg.directory, "pnpm", ["pack", "--out", pkg.tarball]);
			const dependent = join(engine.root, "packages/starter-dependent");
			yield* fs.makeDirectory(dependent, { recursive: true });
			yield* writeJson(join(dependent, "package.json"), {
				dependencies: { [NAME]: pkg.manifest.version },
				name: DEPENDENT,
				types: "index.d.ts",
				version: "1.0.0",
			});
			yield* fs.writeFileString(join(dependent, "index.d.ts"), `export { assertLocalDatabase } from "${NAME}/${engine.module}";\n`);
			const tarball = join(engine.root, "dependent.tgz");
			yield* command(dependent, "pnpm", ["pack", "--out", tarball]);
			yield* fs.writeFileString(
				join(engine.app, "test.ts"),
				`import { assertLocalDatabase } from ${JSON.stringify(engine.appImport)};\nassertLocalDatabase("postgres://localhost:5432/test", ["test"], ["5432"]);\n`,
			);
			engine.packages = [
				pkg,
				{ directory: dependent, manifest: { name: DEPENDENT, version: "1.0.0" }, tarball },
				{ directory: join(engine.root, "packages/create-app"), manifest: { name: GENERATOR, version: engine.generatorVersion }, tarball: "" },
			];
		},
	},
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "pinned-starter-" });
		const published = {
			[DEPENDENT]: { dependencies: { [NAME]: "1.0.0" }, name: DEPENDENT, types: "index.d.ts", version: "1.0.0" },
			[HELPER]: { name: HELPER, version: "1.0.0" },
			[NAME]: { name: NAME, types: "index.d.ts", version: "1.0.0" },
		};
		const declarations: Record<string, string> = {
			[DEPENDENT]: `export { assertLocalDatabase } from "${NAME}";\n`,
			[HELPER]: "",
			[NAME]: TWO_ARGUMENTS,
		};
		const archives: Record<string, Uint8Array> = {};
		for (const [index, manifest] of Object.values(published).entries()) {
			const source = join(root, `published-${index}`);
			yield* fs.makeDirectory(source);
			yield* writeJson(join(source, "package.json"), manifest);
			yield* fs.writeFileString(join(source, "index.d.ts"), declarations[manifest.name] ?? "");
			const archive = join(root, `published-${index}.tgz`);
			yield* command(source, "pnpm", ["pack", "--out", archive]);
			archives[manifest.name] = yield* fs.readFile(archive);
		}
		const documents: Record<string, { readonly name: string; readonly version: string }> = {
			...published,
			[GENERATOR]: { name: GENERATOR, version: "1.0.0" },
		};
		let registryUrl = "";
		const registry = yield* fakeHttpService({
			routes: {
				archive: { path: "/archives/:name", reply: ({ params }) => ({ chunks: [archives[params.name ?? ""] ?? new Uint8Array()] }) },
				metadata: { path: "/:name", reply: ({ params }) => registryDocument(registryUrl, documents[params.name ?? ""]) },
			},
		});
		registryUrl = registry.url;
		const app = join(root, "app");
		yield* fs.makeDirectory(app);
		yield* writeJson(join(app, "tsconfig.json"), { compilerOptions: { noEmit: true, strict: true, types: [] }, include: ["test.ts"] });
		const pkg: Package = {
			directory: join(root, "packages/starter-pin"),
			manifest: { name: NAME, version: "1.0.0" },
			tarball: join(root, "workspace.tgz"),
		};
		const logs: string[] = [];
		const packages: Package[] = [];
		const pins: Record<string, string> = { [NAME]: "1.0.0" };
		return { app, appImport: NAME, generatorVersion: "1.0.0", logs, module: "index", packages, pins, pkg, registry, root };
	},
	layer: NodeServices.layer,
	name: "starter dependency pins",
	stages: ["release"],
	verbs: (engine, story) => ({
		recordedSources: () => Effect.sync(() => [...engine.logs]),
		typecheck: Effect.fn("PinnedStarter.typecheck")(function* () {
			story.tell("the packed consumer installs the starter's pins and typechecks its adapter");
			const { app, packages, pins, registry, root } = engine;
			return yield* Effect.gen(function* () {
				const tarballs = yield* pinnedTarballs(root, packages, pins).pipe(
					Effect.provide(FetchHttpClient.layer),
					Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ "npm_config_registry": registry.url }))),
					Effect.provide(Logger.layer([Logger.make(({ message }) => engine.logs.push(...[message].flat().map(String)))])),
				);
				const fs = yield* FileSystem.FileSystem;
				const catalog = Object.entries(pins).map(([name, pin]) => `  "${name}": "${pin}"\n`);
				yield* fs.writeFileString(join(app, "pnpm-workspace.yaml"), `packages: []\nregistry: ${registry.url}\ncatalog:\n${catalog.join("")}`);
				yield* writeJson(join(app, "package.json"), {
					dependencies: Object.fromEntries(Object.keys(pins).map((name) => [name, "catalog:"])),
					private: true,
				});
				const path = yield* packedInstaller(process.cwd(), root, tarballs);
				yield* command(app, "env", [`PATH=${path}`, "pnpm", "install"]);
				yield* command(app, join(process.cwd(), "node_modules/.bin/tsc"), ["--project", "tsconfig.json"]);
			}).pipe(Effect.match({ onFailure: (error) => error.message, onSuccess: () => undefined }));
		}),
	}),
});

function registryDocument(origin: string, manifest: { readonly name: string; readonly version: string } | undefined) {
	if (manifest === undefined) {
		return { status: HttpStatus.fromLiteral("NotFound") };
	}
	return {
		body: {
			"dist-tags": { latest: manifest.version },
			name: manifest.name,
			time: { [manifest.version]: "2020-01-01T00:00:00.000Z" },
			versions: { [manifest.version]: { ...manifest, dist: { tarball: `${origin}/archives/${encodeURIComponent(manifest.name)}` } } },
		},
	};
}

export function releasePin(pin: string, workspaceVersion = pin) {
	return pinnedStarter.trait("release", `the starter pins ${pin} and the workspace builds ${workspaceVersion}`, (engine) =>
		Effect.sync(() => {
			engine.pins = { ...engine.pins, [NAME]: pin };
			engine.pkg = { ...engine.pkg, manifest: { ...engine.pkg.manifest, version: workspaceVersion } };
		}),
	);
}

export const registryUnavailable = pinnedStarter.trait("release", "the registry cannot answer package lookups", function* ({ registry }) {
	yield* registry.scriptFault("metadata", { kind: "status", reply: { status: HttpStatus.fromLiteral("ServiceUnavailable") } }, { repeat: true });
});

export const adapterMoved = pinnedStarter.trait(
	"release",
	`the pull request moves ${NAME}'s adapter to adapters/database and the starter imports the new path`,
	(engine) =>
		Effect.sync(() => {
			engine.module = "adapters/database";
			engine.appImport = `${NAME}/adapters/database`;
		}),
);

export const moveChangeset = pinnedStarter.trait("release", `.changeset/move-adapter.md releases ${NAME} as a minor`, function* ({ root }) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.makeDirectory(join(root, ".changeset"));
	yield* fs.writeFileString(
		join(root, ".changeset/move-adapter.md"),
		`---\n"${NAME}": minor\n---\n\n### Breaking\n\n- Import \`assertLocalDatabase\` from \`${NAME}/adapters/database\`.\n`,
	);
});

export const dependentPinned = pinnedStarter.trait(
	"release",
	`the starter also pins ${DEPENDENT}, which re-exports the adapter, and imports it from there`,
	(engine) =>
		Effect.sync(() => {
			engine.pins = { ...engine.pins, [DEPENDENT]: "1.0.0" };
			engine.appImport = DEPENDENT;
		}),
);

export const generatorReleased = pinnedStarter.trait(
	"release",
	`the commit releases ${GENERATOR} 1.1.0, which npm does not have yet, as an approved release does`,
	(engine) =>
		Effect.sync(() => {
			engine.generatorVersion = "1.1.0";
		}),
);

export const helperDeclared = pinnedStarter.trait(
	"release",
	`the pull request adds a dependency on ${HELPER} to ${NAME}, which npm's ${NAME} 1.0.0 does not declare`,
	(engine) =>
		Effect.sync(() => {
			engine.pkg = { ...engine.pkg, manifest: { ...engine.pkg.manifest, dependencies: { [HELPER]: "1.0.0" } } };
		}),
);
