import { join, posix } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { exportTargets } from "#package-check/exports.ts";
import { CODE, missingImportTargets } from "#package-check/imports.ts";
import { command, requireThat } from "#package-check/io.ts";
import { bins, decodeManifest, dependencyKeys, type Manifest, type Package, targets } from "#package-check/model.ts";

const exact = /^(npm:.+@)?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/u;
const SourceMap = Schema.fromJsonString(Schema.Struct({ sourceRoot: Schema.optional(Schema.String), sources: Schema.Array(Schema.String) }));
const decodeMap = Schema.decodeUnknownSync(SourceMap);
const packedPath = (path: string): string => posix.join("package", path);
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

export const checkArchive = (pkg: Package) =>
	Effect.gen(function* () {
		yield* command(pkg.directory, "pnpm", ["pack", "--out", pkg.tarball]);
		return yield* checkPackedArchive(pkg);
	});

export const checkPackedArchive = (pkg: Package) =>
	Effect.gen(function* () {
		const { directory, tarball } = pkg;
		const contents = new Set((yield* command(directory, "tar", ["-tzf", tarball])).trim().split("\n"));
		const manifest = decodeManifest(yield* command(directory, "tar", ["-xOzf", tarball, "package/package.json"]));
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
		yield* checkImports(tarball, manifest, contents);
		const packed = new Set([...contents].map((path) => posix.relative("package", path)));
		const required = [...exportTargets(manifest, packed), ...targets(manifest.types), ...Object.values(bins(manifest))];
		for (const target of required) {
			yield* requireThat(contents.has(packedPath(target)), `${manifest.name}: missing manifest target ${target}`);
		}
		yield* checkFiles(manifest.name, manifest.files ?? [], contents);
		yield* checkMaps(directory, tarball, contents);
		return manifest;
	});

function checkImports(tarball: string, manifest: Manifest, contents: ReadonlySet<string>) {
	return Effect.scoped(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const unpacked = yield* fs.makeTempDirectoryScoped({ prefix: "platform-packed-imports-" });
			yield* command(unpacked, "tar", ["-xzf", tarball]);
			const packed = new Set([...contents].map((path) => posix.relative("package", path)));
			const sources = new Map<string, string>();
			for (const path of [...packed].filter((file) => CODE.test(file))) {
				sources.set(path, yield* fs.readFileString(join(unpacked, "package", path)));
			}
			const problems = missingImportTargets(manifest.imports ?? {}, packed, sources);
			yield* requireThat(problems.length === 0, `${manifest.name}: ${problems.join("; ")}`);
		}),
	);
}

const checkMaps = (directory: string, tarball: string, contents: ReadonlySet<string>) =>
	Effect.gen(function* () {
		for (const path of contents) {
			yield* requireThat(!TEST_FILE.test(path), `packed test file ${path}`);
			if (!path.endsWith(".map")) {
				continue;
			}
			const map = decodeMap(yield* command(directory, "tar", ["-xOzf", tarball, path]));
			for (const source of map.sources) {
				const target = posix.join(posix.dirname(path), map.sourceRoot ?? "", source);
				yield* requireThat(contents.has(target), `${path} references missing ${target}`);
			}
		}
	});
