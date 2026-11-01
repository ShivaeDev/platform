import { expect } from "vitest";
import { app, workerExportsTraces } from "#modules/notes/test-support/application.ts";

app.it(
	"the worker exports its startup log to the trace collector before it takes a job",
	[workerExportsTraces()],
	function* ({ exportedTraceMentions, workerStarts, workerStops }) {
		yield* workerStarts();
		yield* workerStops();

		expect(yield* exportedTraceMentions("Worker ready to take jobs")).toBe("mentions Worker ready to take jobs");
	},
);
