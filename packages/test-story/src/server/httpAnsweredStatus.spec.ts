import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { httpFaultApp } from "#test/httpFaultApp.ts";

const ENDED = { drop: "connection reset", reset: "HTTP 200, then connection reset" };

httpFaultApp.it("records each request with the status it was answered with", [], function* ({ asks, requests }) {
	yield* asks("/data");
	yield* asks("/trigger", { headers: { authorization: "rejected" } });
	yield* asks("/missing");

	expect(yield* requests()).toEqual(["GET /data 200", "GET /trigger 401", "GET /missing 404"]);
});

for (const [kind, gate] of [
	["drop", "hold"],
	["reset", "stall"],
] as const) {
	httpFaultApp.it(
		`records a waiting request that an immediate ${kind} ends as unanswered`,
		[],
		function* ({ answer, fault, hold, requests, sends, stall }) {
			const paused = yield* { hold, stall }[gate]("data");
			yield* sends("client");
			yield* paused.waiting;
			expect(yield* requests()).toEqual(["GET /data pending"]);

			yield* fault("data", { kind });

			yield* outcomes({
				answer: [answer("client"), ENDED[kind]],
				requests: [requests(), ["GET /data unanswered"]],
			});
		},
	);
}

for (const gate of ["hold", "stall"] as const) {
	httpFaultApp.it(`records a client that hangs up on a ${gate} as unanswered`, [], function* ({ abandons, hold, requests, sends, stall }) {
		const paused = yield* { hold, stall }[gate]("data");
		yield* sends("client");
		yield* paused.waiting;
		expect(yield* requests()).toEqual(["GET /data pending"]);

		yield* abandons("client");

		expect(yield* requests()).toEqual(["GET /data unanswered"]);
	});
}

httpFaultApp.it("keeps every unscoped request held until one release answers them all", [], function* ({ answer, asks, hold, requests, sends }) {
	const paused = yield* hold("data");
	yield* sends("first");
	yield* paused.waiting;
	yield* sends("second");
	yield* asks("/trigger");
	expect(yield* requests()).toEqual(["GET /data pending", "GET /data pending", "GET /trigger 200"]);

	yield* paused.release;

	yield* outcomes({
		"first answer": [answer("first"), 'HTTP 200 {"ready":true}'],
		"second answer": [answer("second"), 'HTTP 200 {"ready":true}'],
		"the requests": [requests(), ["GET /data 200", "GET /data 200", "GET /trigger 200"]],
	});
});

httpFaultApp.it("holds only the first unscoped request when the hold is once", [], function* ({ asks, hold, requests, sends }) {
	const paused = yield* hold("data", { once: true });
	yield* sends("first");
	yield* paused.waiting;

	yield* asks("/data");

	expect(yield* requests()).toEqual(["GET /data pending", "GET /data 200"]);
});

for (const kind of ["drop", "reset"] as const) {
	httpFaultApp.it(
		`records a request that a ${kind} scripted before its reply ends as unanswered`,
		[],
		function* ({ answer, requests, scriptFault, sends }) {
			yield* scriptFault("data", { kind });

			yield* sends("client");

			yield* outcomes({
				answer: [answer("client"), ENDED[kind]],
				requests: [requests(), ["GET /data unanswered"]],
			});
		},
	);
}
