import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { changeset, git, makeFixture, run, write } from "./fixture.ts";
import { installCommitGuard } from "./installCommitGuard.ts";
export const workspace = storyKit({
	clock: "live",
	create: makeFixture,
	layer: NodeServices.layer,
	name: "workspace release",
	stages: ["pending", "released", "changed"],
	verbs: ({ root }, story) => ({
		change: (name: string, packages: Readonly<Record<string, string>>, body?: string) =>
			write(root, `.changeset/${name}.md`, changeset(packages, body)),
		checkpoint: (reference = "main") =>
			Effect.sync(() => {
				git(root, ["add", "."]);
				git(root, ["commit", "-m", "Workspace checkpoint"]);
				git(root, ["branch", "-f", reference, "HEAD"]);
			}),
		cli: (...args: readonly string[]) =>
			Effect.sync(() => {
				story.tell(`releases ${args.join(" ")}`);
				return run(root, args);
			}),
		edit: Effect.fn("ChangesetsStory.edit")(function* (file: string, change: (text: string) => string) {
			const fs = yield* FileSystem.FileSystem;
			yield* write(root, file, change(yield* fs.readFileString(join(root, file))));
		}),
		exists: Effect.fn("ChangesetsStory.exists")(function* (file: string) {
			return yield* (yield* FileSystem.FileSystem).exists(join(root, file));
		}),
		files: Effect.fn("ChangesetsStory.files")(function* (directory: string) {
			return yield* (yield* FileSystem.FileSystem).readDirectory(join(root, directory));
		}),
		git: Effect.fn("ChangesetsStory.git")((...args: readonly string[]) => Effect.sync(() => git(root, args))),
		move: Effect.fn("ChangesetsStory.move")(function* (from: string, to: string) {
			yield* (yield* FileSystem.FileSystem).rename(join(root, from), join(root, to));
		}),
		packageVersion: Effect.fn("ChangesetsStory.packageVersion")(function* (directory: string) {
			const fs = yield* FileSystem.FileSystem;
			return JSON.parse(yield* fs.readFileString(join(root, directory, "package.json"))).version;
		}),
		read: Effect.fn("ChangesetsStory.read")(function* (file: string) {
			return yield* (yield* FileSystem.FileSystem).readFileString(join(root, file));
		}),
		remove: Effect.fn("ChangesetsStory.remove")(function* (file: string) {
			yield* (yield* FileSystem.FileSystem).remove(join(root, file));
		}),
		write: (file: string, text: string) => write(root, file, text),
	}),
});
export const guardedCommits = workspace.trait("pending", "global and repository hooks reject absolute machine paths", ({ root }) =>
	installCommitGuard(root),
);
export function pending(packages: Readonly<Record<string, string>> = { "@test/core": "minor" }) {
	return workspace.trait("pending", "a changeset requests explicit bumps", ({ root }) => write(root, ".changeset/feature.md", changeset(packages)));
}
export const released = workspace.trait("released", "the pending release has been applied by the CLI", function* ({ root }) {
	yield* Effect.sync(() => {
		git(root, ["add", "."]);
		git(root, ["commit", "-m", "Pending changes"]);
		git(root, ["branch", "-f", "main", "HEAD"]);
		const result = run(root, ["apply"]);
		if (result.status !== 0) {
			throw new Error(`Could not apply the release precondition: ${result.stderr}`);
		}
	});
});
