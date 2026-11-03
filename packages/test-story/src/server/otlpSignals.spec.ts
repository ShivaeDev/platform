import { expect } from "vitest";
import { attempt } from "#test/attempt.ts";
import { otlpApp } from "#test/otlpApp.ts";

const app = otlpApp(false);

app.it("resolves a pending span wait when the real exporter delivers it", [], function* ({ startsWaitingForSpan, tracesWork, shutsDown, finished }) {
	yield* startsWaitingForSpan("child");

	yield* tracesWork();
	yield* shutsDown();

	expect(yield* finished("child")).toBe("child");
});

app.it("resolves a span wait from a real export that already arrived", [], function* ({ tracesWork, shutsDown, waitsForSpan }) {
	yield* tracesWork();
	yield* shutsDown();

	expect(yield* waitsForSpan("child")).toMatchObject({ kind: 3, name: "child" });
});

app.it(
	"names a missing span and shows the last exported span at the deadline",
	[],
	function* ({ tracesWork, tracesFailure, shutsDown, waitsForSpan }) {
		yield* tracesWork();
		yield* tracesFailure();
		yield* shutsDown();

		const result = yield* attempt(waitsForSpan("missing", "30 millis"));
		expect(result).toContain('Signal "exported missing span" never arrived: the live-time deadline expired.\nLast value seen:');
		expect(result).toContain('"name":"failed"');
		expect(result).toContain("help: Check that the action emits this signal");
	},
);
