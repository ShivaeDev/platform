import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { applyRelease } from "@shivaedev/changesets/applyRelease.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { checkPlatform } from "#release/check.ts";
import config from "#release-config";
import { copyRepository } from "./copyRepository.ts";

function git(root: string, ...args: readonly string[]) {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" });
}

const write = Effect.fn("ReleaseRepository.write")(function* (root: string, relative: string, text: string) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.makeDirectory(dirname(join(root, relative)), { recursive: true });
	yield* fs.writeFileString(join(root, relative), text);
});

const create = Effect.fn("ReleaseRepository.create")(function* () {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.makeTempDirectoryScoped({ prefix: "release-repository-" });
	const copy = yield* fs.makeTempDirectoryScoped({ prefix: "release-copy-" });
	for (const manifest of [
		{ name: "@shivaedev/platform", version: "0.15.0" },
		{ name: "@shivaedev/create-app", version: "0.9.0" },
		{ name: "@shivaedev/work-board", version: "0.4.0" },
		{ dependencies: { "@shivaedev/platform": "workspace:*" }, name: "@shivaedev/work-fleet", version: "0.3.0" },
	]) {
		const directory = `packages/${manifest.name.slice("@shivaedev/".length)}`;
		yield* write(root, `${directory}/package.json`, JSON.stringify(manifest));
		yield* write(root, `${directory}/CHANGELOG.md`, `# Changelog\n\n## ${manifest.version}\n\n### Fixed\n\n- Released behavior.\n`);
	}
	yield* write(root, "packages/work-board/src/server/packageInfo.ts", 'export const VERSION = "0.4.0";\n');
	yield* write(root, "packages/work-fleet/src/packageInfo.ts", 'export const VERSION = "0.3.0";\n');
	yield* write(root, "examples/starter/published-versions.json", '{"@shivaedev/platform":"0.15.0","@shivaedev/work-fleet":"0.3.0"}\n');
	yield* write(
		root,
		".changeset/pending.md",
		'---\n"@shivaedev/platform": patch\n"@shivaedev/create-app": patch\n"@shivaedev/work-board": patch\n---\n\n### Fixed\n\n- Pending behavior.\n',
	);
	yield* write(root, "AGENTS.md", "Repository instructions.\n");
	yield* write(root, ".agents/skills/package-docs/SKILL.md", "Package documentation.\n");
	yield* fs.makeDirectory(join(root, ".claude/skills"), { recursive: true });
	yield* fs.symlink("AGENTS.md", join(root, "CLAUDE.md"));
	yield* fs.symlink("../../.agents/skills/package-docs", join(root, ".claude/skills/package-docs"));
	yield* Effect.sync(() => {
		git(root, "init", "-b", "main");
		git(root, "config", "user.email", "release@example.test");
		git(root, "config", "user.name", "Release Stories");
		git(root, "add", ".");
		git(root, "commit", "-m", "Pending workspace release");
	});
	return { copy, root };
});

export const repository = storyKit({
	clock: "live",
	create,
	layer: NodeServices.layer,
	name: "Repository release policy",
	stages: ["pending"],
	verbs: ({ copy, root }) => ({
		apply: Effect.fn("ReleaseRepository.apply")(() => applyRelease(root, config)),
		check: Effect.fn("ReleaseRepository.check")(() =>
			checkPlatform(root, "main").pipe(Effect.match({ onFailure: (error) => error.message, onSuccess: () => undefined })),
		),
		copy: Effect.fn("ReleaseRepository.copy")(function* () {
			yield* copyRepository(root, copy);
			yield* Effect.sync(() => {
				git(copy, "init", "-b", "main");
				git(copy, "config", "user.email", "release@example.test");
				git(copy, "config", "user.name", "Release Stories");
				git(copy, "add", ".");
				git(copy, "commit", "-m", "Copied repository");
			});
		}),
		gitCopy: Effect.fn("ReleaseRepository.gitCopy")((...args: readonly string[]) => Effect.sync(() => git(copy, ...args))),
		read: Effect.fn("ReleaseRepository.read")(function* (relative: string) {
			return yield* (yield* FileSystem.FileSystem).readFileString(join(root, relative));
		}),
		readCopy: Effect.fn("ReleaseRepository.readCopy")(function* (relative: string) {
			return yield* (yield* FileSystem.FileSystem).readFileString(join(copy, relative));
		}),
		remove: Effect.fn("ReleaseRepository.remove")(function* (relative: string) {
			yield* (yield* FileSystem.FileSystem).remove(join(root, relative));
		}),
		write: (relative: string, text: string) => write(root, relative, text),
		writeCopy: (relative: string, text: string) => write(copy, relative, text),
	}),
});
