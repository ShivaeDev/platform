import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { checkPackedArchive } from "#package-check/archive.ts";
import { command, writeJson } from "#package-check/io.ts";
import { PackedFixture } from "./PackedFixture.ts";

export const archiveRegressions = storyKit({
	after: {
		*archive({ directory, tarball }) {
			yield* command(directory, "tar", ["-czf", tarball, "package"]);
		},
	},
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const fixture = yield* PackedFixture;
		const directory = yield* fs.makeTempDirectoryScoped({ prefix: "archive-regression-" });
		yield* command(directory, "tar", ["-xzf", fixture.tarball]);
		return { ...fixture, directory, tarball: join(directory, "mutated.tgz") };
	},
	layer: PackedFixture.layer,
	name: "packed archive validation",
	stages: ["archive"],
	verbs: (pkg) => ({
		check: () => checkPackedArchive(pkg).pipe(Effect.match({ onFailure: (error) => error.message, onSuccess: () => undefined })),
	}),
});

export const missingSharedPeer = archiveRegressions.trait("archive", "the shared Effect peer is missing", function* ({ directory, manifest }) {
	yield* writeJson(join(directory, "package/package.json"), {
		...manifest,
		peerDependencies: Object.fromEntries(Object.entries(manifest.peerDependencies ?? {}).filter(([name]) => name !== "@effect/platform-node-shared")),
	});
});

export function missingFile(path: string) {
	return archiveRegressions.trait("archive", `${path} is missing`, function* ({ directory }) {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.remove(join(directory, "package", path));
	});
}

export function packedFile(path: string, source: string) {
	return archiveRegressions.trait("archive", `${path} is packed`, function* ({ directory }) {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.writeFileString(join(directory, "package", path), source);
	});
}
