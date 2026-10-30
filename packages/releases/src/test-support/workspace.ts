import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Clock, Effect, FileSystem, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { ReleasePlan } from "#model.ts";
import { makeFixture, runCli } from "./fixture.ts";
import { manifestOf, rangeOn } from "./manifests.ts";

const WORKSPACE_FOLDERS = [".changeset", "modules", "packages"];
const decodePlan = Schema.decodeUnknownSync(Schema.fromJsonString(ReleasePlan));

function answerOf<A>(result: ReturnType<typeof runCli>, success: (stdout: string) => A): A | string {
	if (result.status === 0) {
		return success(result.stdout);
	}
	const message = result.stderr.trim();
	return result.status === 1 && message !== "" ? `refused: ${message}` : `crashed with exit ${result.status}: ${message}`;
}

function printedLines(stdout: string): readonly string[] {
	return stdout.trim().split("\n");
}

export const workspace = storyKit({
	clock: "live",
	create: makeFixture,
	inspect: ({ answers }) => ({ answers }),
	layer: NodeServices.layer,
	name: "workspace release",
	stages: ["workspace", "pending", "main", "changed"],
	verbs: (engine, story) => {
		const { root } = engine;
		function releases<A>(args: readonly string[], success: (stdout: string) => A) {
			return Effect.sync(() => {
				story.tell(`releases ${args.join(" ")}`);
				const answer = answerOf(runCli(root, args), success);
				engine.answers.push(answer);
				return answer;
			});
		}
		const readFile = Effect.fn("ReleasesStory.readFile")(function* (file: string) {
			return yield* (yield* FileSystem.FileSystem).readFileString(join(root, file));
		});
		return {
			apply: () => releases(["apply"], printedLines),
			changelog: Effect.fn("ReleasesStory.changelog")(function* (name: string) {
				const fs = yield* FileSystem.FileSystem;
				const file = join(root, (yield* manifestOf(root, name)).directory, "CHANGELOG.md");
				return (yield* fs.exists(file)) ? yield* fs.readFileString(file) : "no changelog";
			}),
			changesetFiles: Effect.fn("ReleasesStory.changesetFiles")(function* () {
				return (yield* (yield* FileSystem.FileSystem).readDirectory(join(root, ".changeset"))).sort();
			}),
			changesetText: (file: string) => readFile(`.changeset/${file}`),
			check: (base?: string) => releases(base === undefined ? ["check"] : ["check", base], () => "valid"),
			dependencyRange: Effect.fn("ReleasesStory.dependencyRange")(function* (dependent: string, dependency: string) {
				const { field, range } = rangeOn(yield* manifestOf(root, dependent), dependency);
				return `${range} in ${field}`;
			}),
			hookRecord: Effect.fn("ReleasesStory.hookRecord")(function* () {
				return printedLines(yield* readFile("hook-record.txt"));
			}),
			lastAnswer: () => Effect.sync(() => engine.answers.at(-1)),
			manifestFile: Effect.fn("ReleasesStory.manifestFile")(function* (name: string) {
				return (yield* manifestOf(root, name)).text;
			}),
			plan: () => releases(["plan"], printedLines),
			planJson: () => releases(["plan", "--json"], decodePlan),
			todayInUtc: () => Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis).toISOString().slice(0, 10)),
			version: Effect.fn("ReleasesStory.version")(function* (name: string) {
				return (yield* manifestOf(root, name)).manifest.version;
			}),
			workspaceFiles: Effect.fn("ReleasesStory.workspaceFiles")(function* () {
				const fs = yield* FileSystem.FileSystem;
				const files: Record<string, string> = {};
				for (const folder of WORKSPACE_FOLDERS) {
					const entries = (yield* fs.exists(join(root, folder))) ? yield* fs.readDirectory(join(root, folder), { recursive: true }) : [];
					for (const entry of entries.sort()) {
						const file = join(folder, entry);
						if ((yield* fs.stat(join(root, file))).type === "File") {
							files[file] = yield* readFile(file);
						}
					}
				}
				return files;
			}),
		};
	},
});
