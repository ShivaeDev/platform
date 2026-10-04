import { createHash } from "node:crypto";
import { join } from "node:path";
import { Config, Effect, FileSystem, Schema } from "effect";
import { checkArchive } from "#package-check/archive.ts";
import { requireThat, writeJson } from "#package-check/io.ts";
import { decodeManifest, type Package } from "#package-check/model.ts";

const Inventory = Schema.Struct({
	packages: Schema.Array(Schema.Struct({ name: Schema.String, sha256: Schema.String, version: Schema.String })),
	sha: Schema.String,
});
const decodeInventory = Schema.decodeUnknownSync(Schema.fromJsonString(Inventory));
function checksum(bytes: Uint8Array) {
	return createHash("sha256").update(bytes).digest("hex");
}

export function workspaceArchives(root: string, archives: string) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const packages: Package[] = [];
		for (const name of (yield* fs.readDirectory(join(root, "packages"))).sort()) {
			const directory = join(root, "packages", name);
			const path = join(directory, "package.json");
			if (!(yield* fs.exists(path))) {
				continue;
			}
			const manifest = decodeManifest(yield* fs.readFileString(path));
			if (manifest.private !== true) {
				packages.push({ directory, manifest, tarball: join(archives, `${name}.tgz`) });
			}
		}
		return packages;
	});
}

export function prepareArchives(packages: readonly Package[], archives: string) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.makeDirectory(archives, { recursive: true });
		const inventory: { name: string; sha256: string; version: string }[] = [];
		for (const pkg of packages) {
			yield* checkArchive(pkg);
			inventory.push({ name: pkg.manifest.name, sha256: checksum(yield* fs.readFile(pkg.tarball)), version: pkg.manifest.version });
		}
		yield* writeJson(join(archives, "manifest.json"), {
			packages: inventory,
			sha: yield* Config.string("GITHUB_SHA").pipe(Config.withDefault("local")),
		});
	});
}

export function verifyArchives(packages: readonly Package[], archives: string) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const inventory = decodeInventory(yield* fs.readFileString(join(archives, "manifest.json")));
		yield* requireThat(
			inventory.sha === (yield* Config.string("GITHUB_SHA").pipe(Config.withDefault("local"))),
			"Packed artifacts were produced for another commit",
		);
		yield* requireThat(inventory.packages.length === packages.length, "Packed artifact inventory does not match the workspace");
		for (const pkg of packages) {
			const entry = inventory.packages.find((item) => item.name === pkg.manifest.name);
			yield* requireThat(entry?.version === pkg.manifest.version, `Packed artifact missing or wrong version: ${pkg.manifest.name}`);
			yield* requireThat(entry?.sha256 === checksum(yield* fs.readFile(pkg.tarball)), `Packed artifact checksum mismatch: ${pkg.manifest.name}`);
		}
	});
}
