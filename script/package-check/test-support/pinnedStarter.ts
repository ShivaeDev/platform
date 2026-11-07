import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Effect, FileSystem } from "effect";
import { FetchHttpClient } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { pinnedTarballs } from "#package-check/adapters/pinnedTarballs.ts";
import { command, writeJson } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";
import { packedInstaller } from "#starter-published/packedInstaller.ts";

const NAME = "@fixture/starter-pin";

export const pinnedStarter = storyKit({
	after: {
		*release({ pkg }) {
			yield* writeJson(join(pkg.directory, "package.json"), { ...pkg.manifest, types: "index.d.ts" });
			yield* command(pkg.directory, "pnpm", ["pack", "--out", pkg.tarball]);
		},
	},
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "pinned-starter-" });
		for (const directory of ["published", "workspace", "app"]) {
			yield* fs.makeDirectory(join(root, directory));
		}
		const published = join(root, "published");
		yield* writeJson(join(published, "package.json"), { name: NAME, types: "index.d.ts", version: "1.0.0" });
		yield* fs.writeFileString(
			join(published, "index.d.ts"),
			"export declare function assertLocalDatabase(value: string, names: readonly string[]): void;\n",
		);
		const archive = join(root, "published.tgz");
		yield* command(published, "pnpm", ["pack", "--out", archive]);
		const bytes = yield* fs.readFile(archive);
		let registryUrl = "";
		const registry = yield* fakeHttpService({
			routes: {
				archive: { path: "/published.tgz", reply: () => ({ chunks: [bytes] }) },
				metadata: {
					path: "/:path*",
					reply: () => ({
						body: {
							"dist-tags": { latest: "1.0.0" },
							name: NAME,
							time: { "1.0.0": "2020-01-01T00:00:00.000Z" },
							versions: { "1.0.0": { dist: { tarball: `${registryUrl}/published.tgz` }, name: NAME, version: "1.0.0" } },
						},
					}),
				},
			},
		});
		registryUrl = registry.url;
		const pkg: Package = { directory: join(root, "workspace"), manifest: { name: NAME, version: "1.0.0" }, tarball: join(root, "workspace.tgz") };
		yield* fs.writeFileString(
			join(pkg.directory, "index.d.ts"),
			"export declare function assertLocalDatabase(value: string, names: readonly string[], ports?: readonly string[]): void;\n",
		);
		const app = join(root, "app");
		yield* fs.writeFileString(join(app, "pnpm-workspace.yaml"), `packages: []\nregistry: ${registry.url}\n`);
		yield* writeJson(join(app, "tsconfig.json"), { compilerOptions: { noEmit: true, strict: true, types: [] }, include: ["test.ts"] });
		yield* fs.writeFileString(
			join(app, "test.ts"),
			`import { assertLocalDatabase } from ${JSON.stringify(NAME)};\nassertLocalDatabase("postgres://localhost:5432/test", ["test"], ["5432"]);\n`,
		);
		return { app, pin: "1.0.0", pkg, registry, root };
	},
	layer: NodeServices.layer,
	name: "starter dependency pins",
	stages: ["release"],
	verbs: ({ app, pin, pkg, registry, root }, story) => ({
		typecheck: Effect.fn("PinnedStarter.typecheck")(function* () {
			story.tell("the packed consumer installs the starter's pin and typechecks its adapter");
			return yield* Effect.gen(function* () {
				const tarballs = yield* pinnedTarballs([pkg]).pipe(
					Effect.provide(FetchHttpClient.layer),
					Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ "npm_config_registry": registry.url }))),
				);
				yield* writeJson(join(app, "package.json"), { dependencies: { [NAME]: pin }, private: true });
				const path = yield* packedInstaller(process.cwd(), root, tarballs);
				yield* command(app, "env", [`PATH=${path}`, "pnpm", "install"]);
				yield* command(app, join(process.cwd(), "node_modules/.bin/tsc"), ["--project", "tsconfig.json"]);
			}).pipe(Effect.match({ onFailure: (error) => error.message, onSuccess: () => undefined }));
		}),
	}),
});

export function releasePin(pin: string, workspaceVersion = pin) {
	return pinnedStarter.trait("release", `the starter pins ${pin} and the workspace builds ${workspaceVersion}`, (engine) =>
		Effect.sync(() => {
			engine.pin = pin;
			engine.pkg = { ...engine.pkg, manifest: { ...engine.pkg.manifest, version: workspaceVersion } };
		}),
	);
}

export const registryUnavailable = pinnedStarter.trait("release", "the registry cannot answer package lookups", function* ({ registry }) {
	yield* registry.scriptFault("metadata", { kind: "status", reply: { status: HttpStatus.fromLiteral("ServiceUnavailable") } }, { repeat: true });
});
