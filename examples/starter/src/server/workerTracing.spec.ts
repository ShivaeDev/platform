import { app, signedIn } from "#test-support/application.ts";

for (const protocol of ["http/json", "http/protobuf"]) {
	app.it(
		`counts a note and exports worker spans with service metadata over ${protocol}`,
		[signedIn()],
		function* ({ actor, collector, storedWordCountIs }) {
			const receiver = yield* collector();
			const note = yield* actor().notes.create({ title: "Count these words" });
			yield* receiver.startWorker(protocol);
			yield* storedWordCountIs(note.id, 3);
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
		function* ({ actor, collector, storedWordCountIs, wordCountJobsComplete }) {
			const receiver = yield* collector(status);
			const note = yield* actor().notes.create({ title: "Collector has failed" });
			yield* receiver.startWorker();
			yield* storedWordCountIs(note.id, 3);
			yield* wordCountJobsComplete(1);
			if (status !== "down") {
				yield* receiver.receivesRequests();
			}
		},
		15_000,
	);
}
