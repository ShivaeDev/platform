import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { scopedHttpApp } from "#test/scopedHttpApp.ts";

for (const [credential, caller] of [
	["a wrong route token", { token: "wrong" }],
	["a wrong service key", { serviceKey: "wrong" }],
] as const) {
	scopedHttpApp.it(`rejects ${credential} before the route's hold or scripted fault`, [], function* ({ asks, hold, scriptFault }) {
		yield* hold("installation");
		yield* scriptFault("installation", { kind: "drop" });

		expect(yield* asks("/installations/4", caller)).toBe("HTTP 401");
	});
}

scopedHttpApp.it("accepts a token another route's guard would reject", [], function* ({ asks }) {
	expect(yield* asks("/repos/team/platform/pulls/7", { token: "wrong" })).toBe('HTTP 200 {"owner":"team","repo":"platform","number":"7"}');
});

scopedHttpApp.it("lets an accepted request reach the route's hold and scripted fault", [], function* ({ answer, hold, scriptFault, sends }) {
	const paused = yield* hold("installation");
	yield* scriptFault("installation", { kind: "drop" });
	yield* sends("installation request", "/installations/4");
	yield* paused.waiting;

	yield* paused.release;

	expect(yield* answer("installation request")).toBe("connection reset");
});

scopedHttpApp.it("keeps a one-shot reply for the request the route's guard accepts", [], function* ({ asks, scriptFault }) {
	yield* scriptFault("installation", { kind: "status", reply: { status: HttpStatus.fromLiteral("ServiceUnavailable") } });

	yield* outcomes({
		"a request the guard refuses": [asks("/installations/4", { token: "wrong" }), "HTTP 401"],
		"the next accepted request": [asks("/installations/4"), "HTTP 503"],
	});
});

scopedHttpApp.it(
	"keeps an arrival release for the request the route's guard accepts",
	[],
	function* ({ answer, asks, hold, progress, releaseOnArrival, sends }) {
		const paused = yield* hold("pull");
		yield* releaseOnArrival("pull", "installation");
		yield* sends("pull request", "/repos/team/platform/pulls/7");
		yield* paused.waiting;
		yield* outcomes({
			"a release the guard refuses": [asks("/installations/4", { token: "wrong" }), "HTTP 401"],
			"the pull request": [progress("pull request"), "waiting for an answer"],
		});

		yield* asks("/installations/4");

		expect(yield* answer("pull request")).toBe('HTTP 200 {"owner":"team","repo":"platform","number":"7"}');
	},
);
