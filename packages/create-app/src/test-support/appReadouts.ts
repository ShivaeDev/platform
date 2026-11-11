import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Effect, Schema } from "effect";
import { isolatedGit } from "@shivaedev/test-story/server/adapters/isolatedGit.ts";

const decodeManifest = Schema.decodeUnknownSync(
	Schema.fromJsonString(
		Schema.Struct({
			dependencies: Schema.Record(Schema.String, Schema.String),
			name: Schema.String,
		}),
	),
);
const decodeRecord = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)));

function lines(text: string) {
	return text.split("\n").filter((line) => line !== "");
}

export function commitsIn(folder: string) {
	if (isolatedGit(folder, ["rev-parse", "--verify", "HEAD"]).status !== 0) {
		return [];
	}
	return lines(isolatedGit(folder, ["log", "--format=%an <%ae>: %s"]).stdout);
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
		conflictedFiles: () => Effect.sync(() => lines(isolatedGit(target(), ["diff", "--name-only", "--diff-filter=U"]).stdout)),
		dependsOn: (name: string) => Effect.sync(() => name in decodeManifest(read("package.json")).dependencies),
		exists: (path: string) => Effect.sync(() => existsSync(join(target(), path))),
		file: (path: string) => Effect.sync(() => read(path)),
		fileLines: (path: string, count: number) => Effect.sync(() => read(path).split("\n").slice(0, count)),
		fileMentions: (path: string, text: string) => Effect.sync(() => read(path).includes(text)),
		filesPresent: (paths: readonly string[]) => Effect.sync(() => paths.filter((path) => existsSync(join(target(), path)))),
		filesUnder: (folder: string) =>
			Effect.sync(() =>
				readdirSync(join(target(), folder), { recursive: true, withFileTypes: true })
					.filter((entry) => entry.isFile())
					.map((entry) => relative(join(target(), folder), join(entry.parentPath, entry.name)))
					.sort(),
			),
		generationRecord: () => Effect.sync(() => decodeRecord(read(".create-app.json"))),
		gitState: (path: string) =>
			Effect.sync(() => {
				if (isolatedGit(target(), ["ls-files", "--error-unmatch", "--", path]).status === 0) {
					return "tracked";
				}
				if (isolatedGit(target(), ["check-ignore", "--quiet", "--", path]).status === 0) {
					return "ignored";
				}
				return existsSync(join(target(), path)) ? "untracked" : "missing";
			}),
		manifestFields: () => Effect.sync(() => Object.keys(decodeRecord(read("package.json")))),
		packageName: () => Effect.sync(() => decodeManifest(read("package.json")).name),
		uncommittedChanges: () => Effect.sync(() => lines(isolatedGit(target(), ["status", "--porcelain"]).stdout)),
		wordsIn: (path: string, words: readonly string[]) =>
			Effect.sync(() => words.filter((word) => read(path).toLowerCase().includes(word.toLowerCase()))),
	};
}
