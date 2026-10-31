import { expect } from "vitest";
import { attempt } from "#test/attempt.ts";
import { otlpApp } from "#test/otlpApp.ts";

const app = otlpApp(false);

app.it("resolves a pending span wait when the real exporter delivers it", [], function* ({ startsWaitingForSpan, exportsItsWork, finished }) {
	yield* startsWaitingForSpan("child");

	yield* exportsItsWork();

	expect(yield* finished("child")).toBe("child");
});

app.it("resolves a span wait from a real export that already arrived", [], function* ({ exportsItsWork, waitsForSpan }) {
	yield* exportsItsWork();

	expect(yield* waitsForSpan("child")).toMatchObject({ kind: 3, name: "child" });
});

app.it("names a missing span and shows the last exported span at the deadline", [], function* ({ exportsItsWork, waitsForSpan }) {
	yield* exportsItsWork();

	const result = yield* attempt(waitsForSpan("missing", "30 millis"));
	expect(result).toContain('Signal "exported missing span" never arrived: the live-time deadline expired.\nLast value seen:');
	expect(result).toContain('"name":"failed"');
	expect(result).toContain("help: Check that the action emits this signal");
});
