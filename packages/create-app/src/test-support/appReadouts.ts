import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Schema } from "effect";

const decodeManifest = Schema.decodeUnknownSync(
	Schema.fromJsonString(
		Schema.Struct({
			dependencies: Schema.Record(Schema.String, Schema.String),
			devDependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
			name: Schema.String,
			scripts: Schema.optional(Schema.Record(Schema.String, Schema.String)),
		}),
	),
);
const decodeRecord = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)));

function lines(text: string) {
	return text.split("\n").filter((line) => line !== "");
}

export function gitIn(folder: string, args: readonly string[]) {
	return spawnSync("git", args, { cwd: folder, encoding: "utf8" });
}

export function commitsIn(folder: string) {
	if (gitIn(folder, ["rev-parse", "--verify", "HEAD"]).status !== 0) {
		return [];
	}
	return lines(gitIn(folder, ["log", "--format=%an <%ae>: %s"]).stdout);
}

export function appReadouts(target: () => string) {
	function read(path: string) {
		const file = join(target(), path);
		return existsSync(file) ? readFileSync(file, "utf8") : "missing";
	}
	function ownRepository() {
		return existsSync(join(target(), ".git"));
	}
	return {
		commits: () => Effect.sync(() => (ownRepository() ? commitsIn(target()) : "no repository of its own")),
		conflictedFiles: () => Effect.sync(() => lines(gitIn(target(), ["diff", "--name-only", "--diff-filter=U"]).stdout)),
		dependsOn: (name: string) => Effect.sync(() => name in decodeManifest(read("package.json")).dependencies),
		devDependsOn: (name: string) => Effect.sync(() => name in (decodeManifest(read("package.json")).devDependencies ?? {})),
		exists: (path: string) => Effect.sync(() => existsSync(join(target(), path))),
		file: (path: string) => Effect.sync(() => read(path)),
		fileLines: (path: string, count: number) => Effect.sync(() => read(path).split("\n").slice(0, count)),
		fileMentions: (path: string, text: string) => Effect.sync(() => read(path).includes(text)),
		filesPresent: (paths: readonly string[]) => Effect.sync(() => paths.filter((path) => existsSync(join(target(), path)))),
		generationRecord: () => Effect.sync(() => decodeRecord(read(".create-app.json"))),
		gitState: (path: string) =>
			Effect.sync(() => {
				if (gitIn(target(), ["ls-files", "--error-unmatch", "--", path]).status === 0) {
					return "tracked";
				}
				if (gitIn(target(), ["check-ignore", "--quiet", "--", path]).status === 0) {
					return "ignored";
				}
				return existsSync(join(target(), path)) ? "untracked" : "missing";
			}),
		manifestFields: () => Effect.sync(() => Object.keys(decodeRecord(read("package.json")))),
		packageName: () => Effect.sync(() => decodeManifest(read("package.json")).name),
		script: (name: string) => Effect.sync(() => decodeManifest(read("package.json")).scripts?.[name] ?? "no such script"),
		scriptsMentioning: (words: readonly string[]) =>
			Effect.sync(() =>
				Object.entries(decodeManifest(read("package.json")).scripts ?? {})
					.filter(([, command]) => words.some((word) => command.includes(word)))
					.map(([name]) => name),
			),
		uncommittedChanges: () => Effect.sync(() => lines(gitIn(target(), ["status", "--porcelain"]).stdout)),
		wordsIn: (path: string, words: readonly string[]) =>
			Effect.sync(() => words.filter((word) => read(path).toLowerCase().includes(word.toLowerCase()))),
	};
}
