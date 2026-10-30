import { expect } from "vitest";
import { dyingSave, saves } from "#test/saveStories.ts";

for (const kind of ["create", "editor"] as const) {
	saves.it(`a ${kind} save that dies renders the failure alert`, [dyingSave(kind)], function* ({ alert, submit }) {
		expect(alert()).toBeUndefined();

		yield* submit();

		expect(alert()).toBe(kind === "create" ? "Could not create" : "Could not save");
	});
}
