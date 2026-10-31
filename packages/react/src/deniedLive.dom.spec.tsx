import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { accessRevoked, deniedLive, openedRoute } from "#test/denied-live/story.tsx";

deniedLive.it(
	"revoking three live queries shows their denied state and the not-found screen",
	[openedRoute()],
	function* ({ announce, denyRead, shown, states }) {
		expect(yield* states()).toEqual(["private", "private-details", "private-counts"]);

		yield* denyRead();
		yield* announce();

		yield* outcomes({ queries: [states(), ["denied", "denied", "denied"]], screen: [shown(), "Note not found"] });
	},
);
deniedLive.it(
	"three refused queries make no more requests or policy checks after matching changes and a minute",
	[openedRoute()],
	function* ({ announce, denyRead, invalidate, minutePasses, policyChecks, requests, states }) {
		yield* denyRead();
		yield* announce();
		const before = yield* requests();
		const checks = yield* policyChecks();
		expect(before.toSorted()).toEqual([
			"read private",
			"read private-counts",
			"read private-details",
			"subscribe private",
			"subscribe private-counts",
			"subscribe private-details",
		]);

		yield* invalidate();
		yield* minutePasses();

		yield* outcomes({
			"policy checks": [policyChecks(), checks],
			queries: [states(), ["denied", "denied", "denied"]],
			requests: [requests(), before],
		});
	},
);
deniedLive.it(
	"changing the input after a refusal loads all three public queries",
	[openedRoute()],
	function* ({ announce, changeInput, denyRead, shown, states }) {
		yield* denyRead();
		yield* announce();
		expect(yield* shown()).toBe("Note not found");

		yield* changeInput();

		yield* outcomes({ queries: [states(), ["public", "public-details", "public-counts"]], screen: [shown(), "public"] });
	},
);
deniedLive.it("a route loader refused at entry renders its not-found component", [accessRevoked(), openedRoute()], function* ({ shown }) {
	expect(yield* shown()).toBe("Note not found");
});

deniedLive.it(
	"a refused read stays denied through later matching changes",
	[openedRoute()],
	function* ({ invalidate, requests, refuseReads, states }) {
		yield* refuseReads();
		yield* invalidate();
		const before = yield* requests();
		expect(yield* states()).toEqual(["denied", "denied", "denied"]);

		yield* invalidate();

		yield* outcomes({ queries: [states(), ["denied", "denied", "denied"]], requests: [requests(), before] });
	},
);
