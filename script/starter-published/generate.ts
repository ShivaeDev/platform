import { join, resolve } from "node:path";
import { Effect, FileSystem } from "effect";
import { FetchHttpClient } from "effect/http";
import { packedWorkspace } from "#adapters/packedWorkspace.ts";
import { pinnedTarballs } from "#package-check/adapters/pinnedTarballs.ts";
import { command, requireThat, writeJson } from "#package-check/io.ts";
import { decodeVersions, type Package } from "#package-check/model.ts";
import { packedInstaller } from "#starter-published/packedInstaller.ts";
import { withTarballOverrides } from "#withTarballOverrides.ts";

export const generateStarter = Effect.fn("Published.generateStarter")(function* (
	root: string,
	temporary: string,
	packages: readonly Package[] = [],
	minimal = false,
) {
	const folder = minimal ? "starter-minimal" : "starter";
	const args = [folder, ...(minimal ? ["--minimal"] : [])];
	const fs = yield* FileSystem.FileSystem;
	const pins = decodeVersions(yield* fs.readFileString(join(root, "examples/starter/published-versions.json")));
	const tarballs = yield* pinnedTarballs(root, packages, pins).pipe(Effect.provide(FetchHttpClient.layer));
	const archive = packages.find(({ manifest }) => manifest.name === "@shivaedev/create-app")?.tarball;
	const packed = archive === undefined ? join(temporary, "create-app.tgz") : resolve(root, archive);
	if (archive === undefined) {
		yield* command(root, "pnpm", ["--filter", "@shivaedev/create-app", "build"]);
		yield* command(join(root, "packages/create-app"), "pnpm", ["pack", "--out", packed]);
	}
	const generator = join(temporary, minimal ? "generator-minimal" : "generator");
	yield* fs.makeDirectory(generator);
	yield* writeJson(join(generator, "package.json"), { dependencies: { "@shivaedev/create-app": `file:${packed}` }, private: true });
	yield* fs.writeFileString(join(generator, "pnpm-workspace.yaml"), withTarballOverrides(packedWorkspace("packages: []\n"), tarballs));
	yield* command(generator, "pnpm", ["install", "--registry=https://registry.npmjs.org"]);
	yield* Effect.log(`Generating and installing ${folder} with the packed create-app command.`);
	const bin = join(generator, "node_modules/.bin/create-app");
	const path = yield* packedInstaller(root, generator, tarballs);
	yield* command(temporary, "env", [`PATH=${path}`, bin, ...args]);
	const baseline = join(temporary, folder, "quality-baseline.jsonl");
	yield* requireThat(
		!(yield* fs.exists(baseline)) || (yield* fs.readFileString(baseline)).trim() === "",
		`Generated ${folder} records Quality debt in quality-baseline.jsonl; fix the starter's findings instead of carrying them into new apps.`,
	);
	return { folder, tarballs };
});
