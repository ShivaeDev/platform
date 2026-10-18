import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { command, requireThat, writeJson } from "#package-check/io.ts";
import { decodeManifest, decodeVersions } from "#package-check/model.ts";
import { withTarballOverrides } from "#withTarballOverrides.ts";

export const installDocumentation = Effect.fn("Published.installDocumentation")(function* (
	root: string,
	consumer: string,
	versions: Readonly<Record<string, string>>,
	tarballs: Readonly<Record<string, string>> = {},
) {
	const fs = yield* FileSystem.FileSystem;
	const catalog = decodeVersions(yield* command(root, "pnpm", ["config", "get", "catalog", "--json"]));
	const dependencies: Record<string, string> = {
		...versions,
		"@types/node": catalog["@types/node"] ?? "",
		typescript: catalog.typescript ?? "",
	};
	for (const name of Object.keys(versions)) {
		const manifest = decodeManifest(yield* fs.readFileString(join(root, "packages", name.split("/")[1] ?? "", "package.json")));
		for (const [peer, version] of Object.entries(manifest.peerDependencies ?? {})) {
			const resolved = versions[peer] ?? (version === "catalog:" ? catalog[peer] : version);
			yield* requireThat(resolved !== undefined, `${name}: missing documentation peer ${peer}`);
			dependencies[peer] = resolved ?? "";
		}
	}
	yield* fs.makeDirectory(consumer);
	yield* writeJson(join(consumer, "package.json"), { dependencies, private: true, type: "module" });
	yield* fs.writeFileString(
		join(consumer, "pnpm-workspace.yaml"),
		withTarballOverrides(
			`packages: []\noverrides:\n  "@effect/platform-node-shared": ${catalog["@effect/platform-node-shared"]}\nallowBuilds:\n  esbuild: true\n  msgpackr-extract: true\n`,
			tarballs,
		),
	);
	yield* command(consumer, "pnpm", ["install", "--registry=https://registry.npmjs.org", "--frozen-lockfile=false"]);
});
