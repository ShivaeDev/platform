import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { app, signedIn } from "#test-support/application.ts";

for (const protocol of ["http/json", "http/protobuf"]) {
	app.it(
		`counts a note and exports worker spans with service metadata over ${protocol}`,
		[signedIn()],
		function* ({ actor, collector, storedWordCounts }) {
			const receiver = yield* collector();
			const note = yield* actor().notes.create({ title: "Count these words" });
			const stopWorker = yield* receiver.startWorker(protocol);
			yield* eventually(storedWordCounts(note.id).pipe(Effect.flatMap((rows) => Effect.try(() => expect(rows).toEqual([{ wordCount: 3 }])))), {
				interval: "50 millis",
				times: 160,
			});
			yield* stopWorker;
			yield* receiver.exportsCountWords();
			yield* receiver.omitsSecrets(["worker collector secret", "app-test-secret"]);
		},
		15_000,
	);
}

for (const status of ["down", 500] as const) {
	app.it(
		`completes a worker job and shuts down when the collector ${status === "down" ? "is down" : "returns HTTP 500"}`,
		[signedIn()],
		function* ({ actor, collector, storedWordCounts, wordCountJobs }) {
			const receiver = yield* collector(status);
			const note = yield* actor().notes.create({ title: "Collector has failed" });
			const stopWorker = yield* receiver.startWorker();
			yield* eventually(storedWordCounts(note.id).pipe(Effect.flatMap((rows) => Effect.try(() => expect(rows).toEqual([{ wordCount: 3 }])))), {
				interval: "50 millis",
				times: 160,
			});
			yield* eventually(
				wordCountJobs().pipe(Effect.flatMap((jobs) => Effect.try(() => expect(jobs).toEqual([{ retryCount: 0, state: "completed" }])))),
				{
					interval: "50 millis",
					times: 160,
				},
			);
			yield* stopWorker;
			if (status !== "down") {
				yield* receiver.receivesRequests();
			}
		},
		15_000,
	);
}
