import { join } from "node:path";
import { serialize } from "node:v8";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readSnapshot } from "#internal/snapshot.ts";
import { writeTimedReport } from "#internal/writeTimedReport.ts";

export const filesStory = storyKit({
	create: () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const directory = yield* fs.makeTempDirectoryScoped({ prefix: "vitest-rerun-files-" });
			return { directory, fs };
		}),
	layer: NodeServices.layer,
	name: "rerun report files",
	stages: ["files"],
	verbs: ({ directory, fs }, story) => ({
		readSnapshot: () => {
			story.tell("the snapshot is read");
			return readSnapshot(join(directory, "attempt.snapshot")).pipe(
				Effect.as({ error: "none", message: "decoded" }),
				Effect.catchTag("VitestRerunError", (error) => Effect.succeed({ error: error._tag, message: error.message })),
			);
		},
		report: () =>
			fs.readFileString(join(directory, "tests.json")).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown)))),
		timeReport: () => {
			story.tell("the report receives the file's duration");
			return writeTimedReport(join(directory, "tests.json"), [42]).pipe(
				Effect.as({ error: "none", message: "written" }),
				Effect.catchTag("VitestRerunError", (error) => Effect.succeed({ error: error._tag, message: error.message })),
			);
		},
	}),
});

export function snapshotFile(format: "truncated" | "older" | "invalid task" | "invalid history" | "invalid flaky test") {
	return filesStory.trait("files", `attempt.snapshot contains a ${format} snapshot`, ({ directory, fs }) => {
		const fields = { errors: [], failures: {}, files: [], flaky: [] };
		const contents = {
			"invalid flaky test": { ...fields, flaky: [{ attempts: "two" }] },
			"invalid history": { ...fields, failures: { test: { attempts: "two", messages: [] } } },
			"invalid task": {
				...fields,
				files: [
					{
						filepath: "test.spec.ts",
						fullName: "test.spec.ts",
						id: "file",
						meta: {},
						mode: "run",
						name: "test.spec.ts",
						tasks: [{ id: 42 }],
						type: "suite",
					},
				],
			},
			older: { errors: [], files: [] },
			truncated: fields,
		}[format];
		const bytes = serialize(contents);
		return fs.writeFile(join(directory, "attempt.snapshot"), format === "truncated" ? bytes.subarray(0, 3) : bytes);
	});
}

export function reportFile(contents: string) {
	return filesStory.trait("files", `tests.json contains ${contents}`, ({ directory, fs }) =>
		fs.writeFileString(join(directory, "tests.json"), contents),
	);
}
