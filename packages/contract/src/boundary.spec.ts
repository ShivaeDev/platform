import { expect } from "vitest";
import { boundaryStory } from "#test/boundaryStory.ts";

for (const operation of ["read", "save"] as const) {
	for (const failure of ["unexpected", "defect"] as const) {
		boundaryStory.it(`one group boundary maps ${operation}'s ${failure} failure to its declared public message over HTTP`, [], function* ({ call }) {
			expect(yield* call(operation, failure)).toBe("failed with internal server error: Notes unavailable");
		});
	}
	boundaryStory.it(`the group boundary keeps ${operation}'s successful result over HTTP`, [], function* ({ call }) {
		expect(yield* call(operation, "success")).toBe("a note");
	});
	boundaryStory.it(`the group boundary keeps ${operation}'s declared conflict and message over HTTP`, [], function* ({ call }) {
		expect(yield* call(operation, "declared")).toBe("failed with conflict: Title is taken");
	});
}

for (const failure of ["unexpected", "defect"] as const) {
	boundaryStory.it(`the group boundary maps a wrapped stream's late ${failure} failure after delivering its first note`, [], function* ({ follow }) {
		expect(yield* follow(failure)).toEqual({ ending: "failed with internal server error: Notes unavailable", notes: ["first note"] });
	});
}

boundaryStory.it("an HTTP changes subscription says it needs the WebSocket protocol", [], function* ({ subscribeOverHttp }) {
	expect(yield* subscribeOverHttp()).toBe("failed with boundary.$changes needs the WebSocket protocol");
});
