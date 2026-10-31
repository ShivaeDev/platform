import { expect } from "vitest";
import { app } from "#modules/notes/test-support/application.ts";

app.it("the starter worker exports its startup log through OTLP without an HTTP request", [], function* ({ collector }) {
	const receiver = yield* collector();
	const stopWorker = yield* receiver.startWorker();

	yield* stopWorker;

	expect(receiver.spans.map(({ name }) => name)).toContain("effect.log");
	expect(receiver.requests.map(({ body }) => body.toString()).join("\n")).toContain("Worker ready to take jobs");
});
