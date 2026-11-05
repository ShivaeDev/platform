import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { releaseAgeRegistry } from "#ci/test-support/releaseAgeRegistry.ts";
import { packArchive } from "#package-check/archive.ts";
import { checkConsumer } from "#package-check/consumer.ts";
import { command, writeJson } from "#package-check/io.ts";
import { decodeVersions, type Package } from "#package-check/model.ts";
import { localConsumerWorkspace } from "#package-check/test-support/localConsumerWorkspace.ts";
import { packedInstaller } from "#starter-published/packedInstaller.ts";

export const packedReleaseAge = storyKit({
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "packed-release-age-" });
		const consumer = join(root, "consumer");
		const pkg: Package = {
			directory: join(root, "packages/probe"),
			manifest: { dependencies: { "release-age-parent": "^1.0.0" }, name: "packed-age-probe", version: "1.0.0" },
			tarball: join(root, "probe.tgz"),
		};
		for (const path of [consumer, pkg.directory, join(root, "script/package-check")]) {
			yield* fs.makeDirectory(path, { recursive: true });
		}
		yield* writeJson(join(root, "script/package-check/browser-entries.json"), {});
		yield* writeJson(join(pkg.directory, "package.json"), { ...pkg.manifest, type: "module" });
		yield* fs.writeFileString(join(pkg.directory, "index.js"), 'export { default } from "release-age-parent";\n');
		yield* localConsumerWorkspace(root);
		const registry = yield* releaseAgeRegistry(root);
		const workspace = join(root, "pnpm-workspace.yaml");
		const effect = yield* fs.realPath(join(process.cwd(), "node_modules/effect"));
		yield* fs.writeFileString(
			workspace,
			`${(yield* fs.readFileString(workspace)).replace("offline: true", "offline: false").replace('effect: "catalog:"', `effect: "file:${effect}"`)}registry: ${registry}\nminimumReleaseAge: 10080\nminimumReleaseAgeStrict: true\n`,
		);
		yield* packArchive(pkg);
		const catalog = decodeVersions(yield* command(root, "pnpm", ["config", "get", "catalog", "--json"]));
		return { catalog, consumer, pkg, root };
	},
	layer: NodeServices.layer,
	name: "packed release age",
	stages: [],
	verbs: ({ catalog, consumer, pkg, root }, story) => ({
		install: Effect.fn("PackedAge.install")(function* (path: "consumer" | "starter") {
			story.tell(`the packed ${path} installs its dependencies`);
			if (path === "consumer") {
				yield* checkConsumer(root, pkg, [pkg], catalog, consumer, join(root, "store"));
			} else {
				const fs = yield* FileSystem.FileSystem;
				yield* fs.copyFile(join(root, "pnpm-workspace.yaml"), join(consumer, "pnpm-workspace.yaml"));
				yield* writeJson(join(consumer, "package.json"), { dependencies: { [pkg.manifest.name]: "1.0.0" }, private: true, type: "module" });
				const installer = yield* packedInstaller(process.cwd(), root, { [pkg.manifest.name]: pkg.tarball });
				yield* command(consumer, "env", [`PATH=${installer}`, "pnpm", "install", "--frozen-lockfile=false"]);
			}
		}),
		resolved: () =>
			command(consumer, "node", ["--input-type=module", "--eval", 'import versions from "packed-age-probe"; console.log(JSON.stringify(versions));']),
	}),
});
