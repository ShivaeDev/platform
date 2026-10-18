import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Clock, Effect, FileSystem } from "effect";
import { applyRelease } from "@shivaedev/changesets/applyRelease.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { releaseOnly } from "#ci/releaseOnly.ts";
import { planPullRequest } from "#release/planPullRequest.ts";
import { releasePrRepository } from "#release/test-support/prRepository.ts";
import config from "#release-config";

const create = Effect.fn("ReleaseDiff.create")(function* () {
	const repository = yield* releasePrRepository();
	for (const [name, path] of [
		["work-board", "src/server/packageInfo.ts"],
		["work-fleet", "src/packageInfo.ts"],
	]) {
		yield* repository.write(`packages/${name}/package.json`, JSON.stringify({ name: `@shivaedev/${name}`, version: "0.1.0" }));
		yield* repository.write(`packages/${name}/CHANGELOG.md`, "# Changelog\n");
		yield* repository.write(`packages/${name}/${path}`, 'export const VERSION = "0.1.0";\n');
	}
	yield* repository.pushMain(
		".changeset/pending.md",
		'---\n"@shivaedev/platform": patch\n"@shivaedev/work-board": patch\n"@shivaedev/work-fleet": patch\n---\n\n### Fixed\n\n- Release pending behavior.\n',
	);
	repository.git("switch", "-c", "release/next");
	return repository;
});

export const releaseDiff = storyKit({
	create,
	layer: NodeServices.layer,
	name: "CI release diff",
	stages: ["pending"],
	verbs: ({ git, root, write }) => ({
		apply: Effect.fn("ReleaseDiff.apply")(function* (date = "2020-01-02") {
			yield* planPullRequest(root);
			const clock = yield* Clock.Clock;
			yield* applyRelease(root, config).pipe(Effect.provideService(Clock.Clock, { ...clock, currentTimeMillis: Effect.succeed(Date.parse(date)) }));
		}),
		check: (base = "main", head = "HEAD") => releaseOnly(root, base, head).pipe(Effect.provideService(Clock.Clock, Clock.Clock.defaultValue())),
		commit: () =>
			Effect.sync(() => {
				git("add", "--all");
				git("commit", "-m", "Release candidate");
			}),
		git: (...args: readonly string[]) => Effect.sync(() => git(...args)),
		read: Effect.fn("ReleaseDiff.read")(function* (path: string) {
			return yield* (yield* FileSystem.FileSystem).readFileString(join(root, path));
		}),
		write,
	}),
});
