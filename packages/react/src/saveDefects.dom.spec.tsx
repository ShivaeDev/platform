import { expect } from "vitest";
import { dyingSave, saves } from "#test/saveStories.ts";

for (const [kind, alert] of [
	["create", "Could not create"],
	["editor", "Could not save"],
] as const) {
	saves.it(`a ${kind} save that dies shows ${alert}`, [dyingSave(kind)], function* ({ alert: shownAlert, submit }) {
		expect(yield* shownAlert()).toBe("nothing");

		yield* submit();

		expect(yield* shownAlert()).toBe(alert);
	});
}
