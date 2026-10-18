import { join } from "node:path";
import { Cause, Console, Effect, Exit, FileSystem, type PlatformError, Schema } from "effect";
import { checkPackedArchive } from "#package-check/archive.ts";
import { command, requireThat, writeJson } from "#package-check/io.ts";
import { decodeManifest, type Package } from "#package-check/model.ts";

const SHARED_PEER = "@effect/platform-node-shared";
const decodeObject = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)));
function withoutShared(peers: Readonly<Record<string, string>> | undefined) {
	return Object.fromEntries(Object.entries(peers ?? {}).filter(([name]) => name !== SHARED_PEER));
}

type Mutation = (unpacked: string) => Effect.Effect<void, PlatformError.PlatformError, FileSystem.FileSystem>;

const checkMutation = Effect.fn("Packed.checkMutation")(function* (pkg: Package, label: string, mutate: Mutation, expected: string) {
	const fs = yield* FileSystem.FileSystem;
	const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "platform-archive-regression-" });
	yield* command(temporary, "tar", ["-xzf", pkg.tarball]);
	yield* mutate(join(temporary, "package"));
	const mutated: Package = { ...pkg, tarball: join(temporary, "mutated.tgz") };
	yield* command(temporary, "tar", ["-czf", mutated.tarball, "package"]);
	const result = yield* Effect.exit(checkPackedArchive(mutated));
	yield* requireThat(Exit.isFailure(result), `${label} unexpectedly passed packed archive validation`);
	if (Exit.isFailure(result)) {
		const message = Cause.pretty(result.cause);
		yield* requireThat(message.includes(expected), `${label} failed for an unrelated reason: ${message}`);
		yield* Console.log(`Passed ${label} regression: ${message}`);
	}
}, Effect.scoped);

function removing(target: string): Mutation {
	return (unpacked) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(join(unpacked, target)));
}

function writing(path: string, contents: string): Mutation {
	return (unpacked) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.writeFileString(join(unpacked, path), contents));
}

const withoutSharedPeer = Effect.fn("Packed.withoutSharedPeer")(function* (unpacked: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = join(unpacked, "package.json");
	const source = yield* fs.readFileString(path);
	yield* writeJson(path, { ...decodeObject(source), peerDependencies: withoutShared(decodeManifest(source).peerDependencies) });
});

export const checkArchiveRegressions = Effect.fn("Packed.checkArchiveRegressions")(function* (packages: readonly Package[]) {
	const pkg = packages.find(({ manifest }) => manifest.name === "@shivaedev/heavy-lock");
	if (pkg === undefined) {
		return yield* Effect.fail(new Error("Packed archive regressions require packed Heavy Lock"));
	}
	yield* checkMutation(
		pkg,
		"missing shared Effect peer",
		withoutSharedPeer,
		`${pkg.manifest.name}: executable needs ${SHARED_PEER} as an exact peer`,
	);
	yield* checkMutation(pkg, "missing ./dist/error.js", removing("dist/error.js"), "whose target ./dist/error.js is not packed");
	yield* checkMutation(
		pkg,
		"missing ./dist/with-heavy-lock.js",
		removing("dist/with-heavy-lock.js"),
		"missing manifest target ./dist/with-heavy-lock.js",
	);
	yield* checkMutation(
		pkg,
		"packed dist/lock-file.test.js",
		writing("dist/lock-file.test.js", "export {};\n"),
		"packed test file package/dist/lock-file.test.js",
	);
	yield* checkMutation(
		pkg,
		"source map with a missing source",
		writing("dist/error.js.map", JSON.stringify({ sources: ["../src/missing.ts"], version: 3 })),
		"package/dist/error.js.map references missing package/src/missing.ts",
	);
});
