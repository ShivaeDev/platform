import type { Tracer } from "effect";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { afterTracingApp } from "./afterTracingApp.ts";
import { noteLifetime } from "./lifetimeLog.ts";
import { describeSpan } from "./spanRecording.ts";

let recorded: readonly Tracer.NativeSpan[] = [];

afterTracingApp.it("boots and tears down a host", [], function* ({ keepsSpans }) {
	yield* keepsSpans((spans) => {
		recorded = spans;
	});
});

afterEach(async () => {
	for (const name of ["engine finalizer", "deployment finalizer", "ready finalizer", "host teardown"]) {
		const span = recorded.find((candidate) => candidate.name === name);
		await Effect.runPromise(noteLifetime(`${name}: ${span === undefined ? "missing" : describeSpan(span)}`));
	}
});
