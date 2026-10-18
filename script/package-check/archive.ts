import { join, posix, sep } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { exportTargets } from "#package-check/exports.ts";
import { CODE, missingImportTargets } from "#package-check/imports.ts";
import { command, requireThat } from "#package-check/io.ts";
import { bins, decodeManifest, dependencyKeys, type Manifest, type Package, targets } from "#package-check/model.ts";

const exact = /^(?:npm:.+@)?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const SourceMap = Schema.fromJsonString(Schema.Struct({ sourceRoot: Schema.optional(Schema.String), sources: Schema.Array(Schema.String) }));
const decodeMap = Schema.decodeUnknownSync(SourceMap);
function packedPath(path: string): string {
	return posix.join("package", path);
}
const READ_CONCURRENCY = 32;
const TEST_FILE = /(?:^|\/)(?:tests?|test-support)\/|\.(?:test|spec)\.[^/]*$/u;

function filesEntryHolds(pattern: string, contents: ReadonlySet<string>): boolean {
	return pattern.startsWith("!")
		? ![...contents].some(
				(path) => posix.matchesGlob(path, packedPath(pattern.slice(1))) || posix.matchesGlob(path, packedPath(`${pattern.slice(1)}/**`)),
			)
		: [...contents].some((path) => path === packedPath(pattern) || path.startsWith(`${packedPath(pattern)}/`));
}

function checkFiles(name: string, patterns: readonly string[], contents: ReadonlySet<string>) {
	return Effect.forEach(patterns, (pattern) =>
		requireThat(
			filesEntryHolds(pattern, contents),
			pattern.startsWith("!") ? `${name}: packs files that ${pattern} excludes` : `${name}: empty files entry ${pattern}`,
		),
	);
}

export const packArchive = Effect.fn("Packed.packArchive")(function* (pkg: Package) {
	yield* command(pkg.directory, "pnpm", ["pack", "--out", pkg.tarball]);
});

export const checkPackedArchive = Effect.fn("Packed.checkPackedArchive")(function* (pkg: Package) {
	const fs = yield* FileSystem.FileSystem;
	const unpacked = yield* fs.makeTempDirectoryScoped({ prefix: "platform-packed-" });
	yield* command(unpacked, "tar", ["-xzf", pkg.tarball]);
	const contents = yield* packedFiles(unpacked);
	const manifest = decodeManifest(yield* fs.readFileString(join(unpacked, "package/package.json")));
	for (const key of dependencyKeys) {
		for (const [name, version] of Object.entries(manifest[key] ?? {})) {
			yield* requireThat(exact.test(version), `${manifest.name}: ${key}.${name} is not exact: ${version}`);
		}
	}
	const nodeVersion = manifest.peerDependencies?.["@effect/platform-node"] ?? manifest.dependencies?.["@effect/platform-node"];
	if (Object.keys(bins(manifest)).length > 0 && nodeVersion !== undefined) {
		yield* requireThat(
			manifest.peerDependencies?.["@effect/platform-node-shared"] === nodeVersion,
			`${manifest.name}: executable needs @effect/platform-node-shared as an exact peer at ${nodeVersion}`,
		);
	}
	yield* checkImports(unpacked, manifest, contents);
	const packed = new Set([...contents].map((path) => posix.relative("package", path)));
	const required = [...exportTargets(manifest, packed), ...targets(manifest.types), ...Object.values(bins(manifest))];
	for (const target of required) {
		yield* requireThat(contents.has(packedPath(target)), `${manifest.name}: missing manifest target ${target}`);
	}
	yield* checkFiles(manifest.name, manifest.files ?? [], contents);
	yield* checkMaps(unpacked, contents);
	return manifest;
}, Effect.scoped);

const packedFiles = Effect.fn("Packed.packedFiles")(function* (unpacked: string) {
	const fs = yield* FileSystem.FileSystem;
	const entries = (yield* fs.readDirectory(unpacked, { recursive: true })).map((entry) => entry.split(sep).join(posix.sep)).sort();
	const files = yield* Effect.filter(entries, (entry) => Effect.map(fs.stat(join(unpacked, entry)), ({ type }) => type === "File"), {
		concurrency: READ_CONCURRENCY,
	});
	return new Set(files);
});

const checkImports = Effect.fn("Packed.checkImports")(function* (unpacked: string, manifest: Manifest, contents: ReadonlySet<string>) {
	const fs = yield* FileSystem.FileSystem;
	const packed = new Set([...contents].map((path) => posix.relative("package", path)));
	const code = [...packed].filter((file) => CODE.test(file));
	const sources = new Map(
		yield* Effect.forEach(code, (path) => Effect.map(fs.readFileString(join(unpacked, "package", path)), (source) => [path, source] as const), {
			concurrency: READ_CONCURRENCY,
		}),
	);
	const problems = missingImportTargets(manifest.imports ?? {}, packed, sources);
	yield* requireThat(problems.length === 0, `${manifest.name}: ${problems.join("; ")}`);
});

const checkMaps = Effect.fn("Packed.checkMaps")(function* (unpacked: string, contents: ReadonlySet<string>) {
	const fs = yield* FileSystem.FileSystem;
	for (const path of contents) {
		yield* requireThat(!TEST_FILE.test(path), `packed test file ${path}`);
	}
	yield* Effect.forEach(
		[...contents].filter((path) => path.endsWith(".map")),
		(path) =>
			Effect.gen(function* () {
				const map = decodeMap(yield* fs.readFileString(join(unpacked, path)));
				for (const source of map.sources) {
					const target = posix.join(posix.dirname(path), map.sourceRoot ?? "", source);
					yield* requireThat(contents.has(target), `${path} references missing ${target}`);
				}
			}),
		{ concurrency: READ_CONCURRENCY, discard: true },
	);
});
