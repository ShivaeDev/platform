import { outcomes } from "#outcomes.ts";
import { rateLimited, timedHttpApp } from "#test/httpFaultApp.ts";

for (const phase of ["before", "after"] as const) {
	timedHttpApp.it(
		`builds a one-shot fault's reply ${phase} the route's reply when the request arrives, at the story clock's time`,
		[],
		function* ({ answer, header, scriptFault, sends, timePasses }) {
			yield* scriptFault("data", { kind: "status", reply: rateLimited }, { phase });
			yield* timePasses(12_000);

			yield* sends("client", "/data?value=first");

			yield* outcomes({
				answer: [answer("client"), 'HTTP 429 {"value":"first"}'],
				"rate limit reset": [header("client", "x-ratelimit-reset"), "72000"],
			});
		},
	);
}

for (const phase of ["before", "after"] as const) {
	timedHttpApp.it(
		`builds a repeated fault's reply ${phase} the route's reply again for each arrival`,
		[],
		function* ({ answer, asks, header, scriptFault, sends, timePasses }) {
			yield* scriptFault("data", { kind: "status", reply: rateLimited }, { phase, repeat: true });
			yield* timePasses(12_000);
			yield* asks("/data?value=first");
			yield* timePasses(3000);

			yield* sends("second", "/data?value=second");

			yield* outcomes({
				answer: [answer("second"), 'HTTP 429 {"value":"second"}'],
				"rate limit reset": [header("second", "x-ratelimit-reset"), "75000"],
			});
		},
	);
}

timedHttpApp.it(
	"builds an immediate fault's reply from the waiting request at the time of the fault",
	[],
	function* ({ answer, fault, header, hold, sends, timePasses }) {
		const paused = yield* hold("data");
		yield* sends("client", "/data?value=held");
		yield* paused.waiting;
		yield* timePasses(42_000);

		yield* fault("data", { kind: "status", reply: rateLimited });

		yield* outcomes({
			answer: [answer("client"), 'HTTP 429 {"value":"held"}'],
			"rate limit reset": [header("client", "x-ratelimit-reset"), "102000"],
		});
	},
);
