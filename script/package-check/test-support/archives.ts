import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { checkPackedArchive } from "#package-check/archive.ts";
import { prepareArchives, verifyArchives, workspaceArchives } from "#package-check/archives.ts";
import cases from "#package-check/bin-cases.json" with { type: "json" };
import { blockedEntries, exportEntries, packedFiles } from "#package-check/exports.ts";
import { command } from "#package-check/io.ts";
import { checkServer } from "#package-check/server.ts";

export const archives = storyKit({
	after: {
		workspace: ({ directory, root }) =>
			Effect.gen(function* () {
				yield* prepareArchives(yield* workspaceArchives(root, directory), directory);
			}).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ "GITHUB_SHA": "expected" }))),
	},
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "package-check-story-" });
		yield* fs.makeDirectory(join(root, "packages"));
		return { directory: join(root, "archives"), root };
	},
	layer: NodeServices.layer,
	name: "package check over packed archives",
	stages: ["workspace", "archives"],
	verbs: ({ directory, root }) => ({
		check: Effect.fn("PackageCheckStory.check")(function* () {
			const packages = yield* workspaceArchives(root, directory);
			return yield* Effect.gen(function* () {
				for (const pkg of packages) {
					yield* checkPackedArchive(pkg);
				}
			}).pipe(Effect.match({ onFailure: (error) => error.message, onSuccess: () => undefined }));
		}),
		consumerEntries: Effect.fn("PackageCheckStory.consumerEntries")(function* () {
			return yield* Effect.forEach(yield* workspaceArchives(root, directory), (pkg) =>
				Effect.map(packedFiles(pkg), (packed) => ({
					blocked: blockedEntries(pkg.manifest, packed),
					exported: exportEntries(pkg.manifest, packed),
				})),
			);
		}),
		packages: () => workspaceArchives(root, directory),
		server: Effect.fn("PackageCheckStory.server")(function* () {
			const fs = yield* FileSystem.FileSystem;
			const unpacked = yield* fs.makeTempDirectoryScoped({ prefix: "packed-server-story-" });
			yield* command(unpacked, "tar", ["-xzf", join(directory, "board.tgz")]);
			return yield* checkServer(unpacked, process.execPath, ["package/server.js"], {
				"/_board/react.js": cases["work-board"].pages["/_board/react.js"],
			}).pipe(Effect.match({ onFailure: (error) => error.message, onSuccess: () => undefined }));
		}),
		verify: Effect.fn("PackageCheckStory.verify")(function* () {
			return yield* verifyArchives(yield* workspaceArchives(root, directory), directory).pipe(
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ "GITHUB_SHA": "expected" })),
				Effect.match({ onFailure: (error) => error.message, onSuccess: () => undefined }),
			);
		}),
	}),
});
