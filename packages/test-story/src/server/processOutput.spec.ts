import { expect } from "vitest";
import { attempt } from "#test/attempt.ts";
import { processSignals } from "#test/processSignals.ts";

for (const channel of ["stdout", "stderr"] as const) {
	processSignals.it(`resolves a ${channel} wait from child output split across writes`, [], function* ({ startsWaiting, outputs, finished }) {
		yield* startsWaiting("ready", channel);

		yield* outputs(["booting\nrea"], channel);
		yield* outputs(["dy\r"], channel);
		yield* outputs(["\n"], channel);

		expect(yield* finished("ready")).toBe("ready");
	});
}

processSignals.it("retains earlier lines for later waits", [], function* ({ outputs, waitsForLine, recordedLines }) {
	yield* outputs(["ready\nworking\n"]);
	yield* waitsForLine("working");

	expect(yield* waitsForLine("ready")).toBe("ready");
	expect(recordedLines()).toEqual(["ready", "working"]);
});

processSignals.it("lets concurrent waits observe the same output independently", [], function* ({ startsWaiting, outputs, finished }) {
	yield* startsWaiting("ready");
	yield* startsWaiting("working");

	yield* outputs(["ready\nworking\n"]);

	expect(yield* finished("ready")).toBe("ready");
	expect(yield* finished("working")).toBe("working");
});

processSignals.it("decodes a multibyte character split across writes and a final line without a newline", [], function* ({ outputs, waitsForLine }) {
	yield* outputs([[0x63, 0x61, 0x66, 0xc3]]);
	yield* outputs([[0xa9]], "stdout", true);

	expect(yield* waitsForLine("café")).toBe("café");
});

processSignals.it("names a missing line and the last output when the child output ends", [], function* ({ outputs, waitsForLine }) {
	yield* outputs(["boot failed\n"], "stdout", true);

	expect(yield* attempt(waitsForLine("ready"))).toContain(
		'Signal "stdout line "ready"" never arrived: the stream ended.\nLast value seen: boot failed\nhelp:',
	);
});

processSignals.it("names a missing line when a child stays silent past the deadline", [], function* ({ waitsForLine }) {
	expect(yield* attempt(waitsForLine("ready", "stdout", "30 millis"))).toContain(
		'Signal "stdout line "ready"" never arrived: the live-time deadline expired.\nLast value seen: (no values received)\nhelp:',
	);
});

processSignals.it("ends a pending line wait when the readers scope closes", [], function* ({ startsWaiting, closesReaders, finished }) {
	yield* startsWaiting("ready");

	yield* closesReaders();

	expect(yield* finished("ready")).toContain('Signal "stdout line "ready"" never arrived: the stream ended.');
});
