import { expect } from "vitest";
import { invites } from "#test/invites.ts";

for (const run of ["first", "second"]) {
	invites.it(`${run} story starts the same deterministic invite sequence`, [], function* ({ createInvite }) {
		expect(yield* createInvite()).toBe("30db7efd387a197c");
	});
}
