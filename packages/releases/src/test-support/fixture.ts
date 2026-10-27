import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect, FileSystem, Path } from "effect";
export interface Fixture {
	readonly root: string;
}
export const CORE = "@test/core";
export const HISTORY = "# Changelog\n\n## 0.2.3 - 2026-01-01\n\n### Fixed\n\n- Released history.\n";
const cli = fileURLToPath(new URL("../cli.ts", import.meta.url));
function environment(root: string): readonly string[] {
	const global = `${root}/.git/story-global-config`;
	return existsSync(global) ? [`GIT_CONFIG_GLOBAL=${global}`] : [];
}
export function changeset(packages: Readonly<Record<string, string>>, body = "### Added\n\n- A new feature.\n"): string {
	return `---\n${Object.entries(packages)
		.map(([name, bump]) => `${JSON.stringify(name)}: ${bump}`)
		.join("\n")}\n---\n\n${body}`;
}
export function run(root: string, args: readonly string[]) {
	const result = spawnSync("env", [...environment(root), process.execPath, "--conditions=source", cli, ...args], { cwd: root, encoding: "utf8" });
	return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}
export function git(root: string, args: readonly string[]) {
	return execFileSync("env", [...environment(root), "git", "-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
export const write = Effect.fn("ChangesetsFixture.write")(function* (root: string, file: string, text: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
	yield* fs.writeFileString(path.join(root, file), text);
});
export const makeFixture = Effect.fn("ChangesetsFixture.makeFixture")(function* () {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.makeTempDirectoryScoped({ prefix: "changesets-story-" }).pipe(Effect.orDie);
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
	yield* Effect.sync(() => {
		git(root, ["init", "-b", "main"]);
		git(root, ["config", "--local", "core.hooksPath", ".git/hooks"]);
		git(root, ["config", "user.email", "stories@example.test"]);
		git(root, ["config", "user.name", "Changeset Stories"]);
		git(root, ["add", "."]);
		git(root, ["commit", "-m", "Initial workspace"]);
		git(root, ["switch", "-c", "feature"]);
	});
	yield* fs.writeFileString(`${root}/.git/info/exclude`, "node_modules/\n").pipe(Effect.orDie);
	yield* fs.symlink(fileURLToPath(new URL("../../node_modules", import.meta.url)), `${root}/node_modules`).pipe(Effect.orDie);
	return { root };
});
