import { expect } from "vitest";
import { host } from "#test/app-host/story.ts";
import { taxonomyGuards } from "#test/app-host/taxonomyGuards.ts";

for (const [kind, expected] of [
	["instance", "class rejection handled"],
	["look-alike", "unrecognized failure"],
]) {
	host.it(`the Conflict guard returns ${expected} for a ${kind}`, [taxonomyGuards], function* ({ request }) {
		const response = yield* request(`/guard/${kind}`);

		expect(response.body).toBe(expected);
	});
}
