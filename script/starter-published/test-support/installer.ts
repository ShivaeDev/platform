import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { command, writeJson } from "#package-check/io.ts";
import { packedInstaller } from "#starter-published/packedInstaller.ts";

export const installer = storyKit({
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "packed-installer-story-" });
		const source = join(root, "source");
		const archives = join(root, "archives");
		const app = join(root, "app");
		for (const directory of [source, archives, app, join(root, "global-hooks")]) {
			yield* fs.makeDirectory(directory);
		}
		yield* writeJson(join(source, "package.json"), { name: "@fixture/packed", version: "1.0.0" });
		yield* command(source, "pnpm", ["pack", "--out", join(archives, "packed.tgz")]);
		yield* writeJson(join(app, "package.json"), { dependencies: { "@fixture/packed": "1.0.0" }, private: true });
		yield* fs.writeFileString(join(app, "pnpm-workspace.yaml"), "packages: []\n");
		yield* fs.writeFileString(join(app, ".gitignore"), "node_modules/\n");
		yield* command(app, "git", ["init", "-b", "main"]);
		yield* command(app, "git", ["config", "user.name", "Installer Story"]);
		yield* command(app, "git", ["config", "user.email", "installer@example.test"]);
		yield* fs.writeFileString(join(app, ".git/hooks/pre-commit"), "#!/bin/sh\ntouch .git/local-hook-ran\n");
		yield* fs.chmod(join(app, ".git/hooks/pre-commit"), 0o755);
		yield* fs.writeFileString(
			join(root, "global-hooks/pre-commit"),
			'#!/bin/sh\nif git grep --cached -I -F "$(dirname "$(pwd)")"; then\n  echo "Commit contains an absolute temporary path" >&2\n  exit 1\nfi\ntouch .git/global-hook-ran\n',
		);
		yield* fs.chmod(join(root, "global-hooks/pre-commit"), 0o755);
		const global = join(root, "gitconfig");
		yield* fs.writeFileString(global, `[core]\n\thooksPath = ${JSON.stringify(join(root, "global-hooks"))}\n`);
		const path = yield* packedInstaller(process.cwd(), root, { "@fixture/packed": join(archives, "packed.tgz") });
		return { app, global, path, root };
	},
	layer: NodeServices.layer,
	name: "packed app installer",
	stages: [],
	verbs: ({ app, global, path, root }, story) => ({
		commit: Effect.fn("InstallerStory.commit")(function* () {
			story.tell("the app makes its first commit");
			yield* command(app, "git", ["add", "."]);
			return yield* command(app, "env", [`GIT_CONFIG_GLOBAL=${global}`, "git", "commit", "-m", "Initial app"]);
		}),
		git: (...args: readonly string[]) => command(app, "git", args),
		install: Effect.fn("InstallerStory.install")(function* () {
			story.tell("the app installs packed dependencies");
			yield* command(app, "env", [`PATH=${path}`, `GIT_CONFIG_GLOBAL=${global}`, "pnpm", "install"]);
		}),
		localHookRan: Effect.fn("InstallerStory.localHookRan")(function* () {
			return yield* (yield* FileSystem.FileSystem).exists(join(app, ".git/local-hook-ran"));
		}),
		root,
	}),
});
