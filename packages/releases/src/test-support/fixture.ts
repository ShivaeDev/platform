import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect, FileSystem, Path } from "effect";
import { git } from "#git.ts";
import { runCommand } from "#runCommand.ts";

export const CORE = "@test/core";
export const HISTORY = "# Changelog\n\n## 0.2.3 - 2026-01-01\n\n### Fixed\n\n- Released history.\n";
export const RELEASED_HISTORY = HISTORY.slice("# Changelog\n\n".length);
export const FEATURE_NOTE = "### Added\n\n- A new feature.\n";

const cli = fileURLToPath(new URL("../cli.ts", import.meta.url));

export function changeset(packages: Readonly<Record<string, string>>, body = FEATURE_NOTE): string {
	return `---\n${Object.entries(packages)
		.map(([name, bump]) => `${JSON.stringify(name)}: ${bump}`)
		.join("\n")}\n---\n\n${body}`;
}

export function runCli(root: string, args: readonly string[]) {
	return runCommand(root, process.execPath, ["--conditions=source", cli, ...args]);
}

export const write = Effect.fn("ReleasesFixture.write")(function* (root: string, file: string, text: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
	yield* fs.writeFileString(path.join(root, file), text);
});

export const makeFixture = Effect.fn("ReleasesFixture.makeFixture")(function* () {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.makeTempDirectoryScoped({ prefix: "releases-story-" }).pipe(Effect.orDie);
	const manifests = [
		{ name: CORE, version: "0.2.3" },
		{ dependencies: { [CORE]: "workspace:*" }, name: "@test/api", version: "0.5.0" },
		{ name: "@test/optional", optionalDependencies: { "@test/api": "^0.5.0" }, version: "1.0.0" },
		{ name: "@test/peer", peerDependencies: { "@test/optional": "workspace:1.0.0" }, version: "1.0.0" },
		{ dependencies: { [CORE]: "workspace:*" }, name: "@test/private", private: true, version: "1.0.0" },
		{ devDependencies: { [CORE]: "workspace:*" }, name: "@test/dev", version: "1.0.0" },
	];
	for (const manifest of manifests) {
		const directory = `packages/${manifest.name.slice("@test/".length)}`;
		yield* write(root, `${directory}/package.json`, JSON.stringify(manifest)).pipe(Effect.orDie);
		yield* write(root, `${directory}/CHANGELOG.md`, HISTORY).pipe(Effect.orDie);
	}
	yield* write(root, "package.json", '{"private":true,"type":"module"}\n').pipe(Effect.orDie);
	yield* Effect.gen(function* () {
		yield* git(root, ["init", "-b", "main"]);
		// The fixture's commits must not run the hooks of the machine's global git config.
		yield* git(root, ["config", "--local", "core.hooksPath", ".git/hooks"]);
		yield* git(root, ["config", "user.email", "stories@example.test"]);
		yield* git(root, ["config", "user.name", "Release Stories"]);
		yield* git(root, ["add", "."]);
		yield* git(root, ["commit", "-m", "Initial workspace"]);
		yield* git(root, ["switch", "-c", "feature"]);
	});
	yield* fs.writeFileString(`${root}/.git/info/exclude`, "node_modules/\n").pipe(Effect.orDie);
	// Config modules and hooks import effect by its bare name, as they do in a real repository.
	yield* fs.symlink(fileURLToPath(new URL("../../node_modules", import.meta.url)), `${root}/node_modules`).pipe(Effect.orDie);
	const answers: unknown[] = [];
	return { answers, root };
});
