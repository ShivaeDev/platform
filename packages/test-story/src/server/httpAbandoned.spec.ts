import { expect } from "vitest";
import { attempt } from "#test/attempt.ts";
import { httpFaultApp } from "#test/httpFaultApp.ts";

for (const gate of ["hold", "stall"] as const) {
	httpFaultApp.it(
		`signals an abandoned ${gate} request with its method, path and status`,
		[],
		function* ({ abandons, hold, sends, stall, waitsForAbandoned }) {
			const paused = yield* { hold, stall }[gate]("data");
			yield* sends("client");
			yield* paused.waiting;

			yield* abandons("client");

			expect(yield* waitsForAbandoned("/data")).toMatchObject({ method: "GET", path: "/data", status: "unanswered" });
		},
	);
}

httpFaultApp.it("signals an unfinished connection closed by a scripted fault", [], function* ({ fault, hold, sends, waitsForAbandoned }) {
	const paused = yield* hold("data");
	yield* sends("client");
	yield* paused.waiting;

	yield* fault("data", { kind: "drop" });

	expect(yield* waitsForAbandoned("/data")).toMatchObject({ method: "GET", path: "/data", status: "unanswered" });
});

httpFaultApp.it("does not signal a completed response as abandoned and explains the missing signal", [], function* ({ asks, waitsForAbandoned }) {
	yield* asks("/data");

	expect(yield* attempt(waitsForAbandoned("/data", "30 millis"))).toContain(
		'Signal "abandoned /data" never arrived: the live-time deadline expired.\nLast value seen: (no values received)\nhelp:',
	);
});
