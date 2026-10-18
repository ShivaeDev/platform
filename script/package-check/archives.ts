import { createHash } from "node:crypto";
import { join } from "node:path";
import { Config, Effect, FileSystem, Schema } from "effect";
import { checkPackedArchive, packArchive } from "#package-check/archive.ts";
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

export const workspaceArchives = Effect.fn("Packed.workspaceArchives")(function* (root: string, archives: string) {
	const fs = yield* FileSystem.FileSystem;
	const packages: Package[] = [];
	for (const name of (yield* fs.readDirectory(join(root, "packages"))).sort()) {
		const directory = join(root, "packages", name);
		const path = join(directory, "package.json");
		if (!(yield* fs.exists(path))) {
			continue;
		}
		const manifest = decodeManifest(yield* fs.readFileString(path));
		packages.push({ directory, manifest, tarball: join(archives, `${name}.tgz`) });
	}
	return packages;
});

export const prepareArchives = Effect.fn("Packed.prepareArchives")(function* (packages: readonly Package[], archives: string) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.makeDirectory(archives, { recursive: true });
	const concurrency = yield* Config.Int("CI_WORKSPACE_CONCURRENCY").pipe(Config.withDefault(1));
	yield* requireThat(concurrency > 0, "CI_WORKSPACE_CONCURRENCY must be positive");
	yield* Effect.forEach(packages, packArchive, { concurrency, discard: true });
	const inventory = yield* Effect.forEach(packages, (pkg) => Effect.map(fs.readFile(pkg.tarball), (bytes) => ({ bytes, pkg })));
	const largestFirst = inventory.toSorted((left, right) => right.bytes.byteLength - left.bytes.byteLength);
	yield* Effect.forEach(largestFirst, ({ pkg }) => checkPackedArchive(pkg), { concurrency, discard: true });
	yield* writeJson(join(archives, "manifest.json"), {
		packages: inventory.map(({ bytes, pkg }) => ({ name: pkg.manifest.name, sha256: checksum(bytes), version: pkg.manifest.version })),
		sha: yield* Config.String("GITHUB_SHA").pipe(Config.withDefault("local")),
	});
});

export const verifyArchives = Effect.fn("Packed.verifyArchives")(function* (packages: readonly Package[], archives: string) {
	const fs = yield* FileSystem.FileSystem;
	const inventory = decodeInventory(yield* fs.readFileString(join(archives, "manifest.json")));
	yield* requireThat(
		inventory.sha === (yield* Config.String("GITHUB_SHA").pipe(Config.withDefault("local"))),
		"Packed artifacts were produced for another commit",
	);
	yield* requireThat(inventory.packages.length === packages.length, "Packed artifact inventory does not match the workspace");
	for (const pkg of packages) {
		const entry = inventory.packages.find((item) => item.name === pkg.manifest.name);
		yield* requireThat(entry?.version === pkg.manifest.version, `Packed artifact missing or wrong version: ${pkg.manifest.name}`);
		yield* requireThat(entry?.sha256 === checksum(yield* fs.readFile(pkg.tarball)), `Packed artifact checksum mismatch: ${pkg.manifest.name}`);
	}
});
