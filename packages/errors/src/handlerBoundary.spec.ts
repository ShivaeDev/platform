import { expect } from "vitest";
import { handlerBoundary } from "#test/handlerBoundary.ts";

for (const method of ["Read", "ForkRead", "Follow", "ForkFollow"] as const) {
	for (const outcome of ["throws", "unexpected", "defect"] as const) {
		handlerBoundary.it(`${method} maps ${outcome} to the group's declared fallback`, [], function* ({ call }) {
			const answer = yield* call(method, outcome);

			expect(answer).toMatchObject({ rejected: { _tag: "InternalServerError", message: "Notes unavailable" } });
		});
	}

	handlerBoundary.it(`${method} keeps its successful response`, [], function* ({ call }) {
		const answer = yield* call(method, "success");

		expect(answer).toEqual({ received: ["a note"] });
	});
	handlerBoundary.it(`${method} keeps a declared rejection`, [], function* ({ call }) {
		const answer = yield* call(method, "declared");

		expect(answer).toMatchObject({ rejected: { _tag: "Conflict", field: "title", message: "Title is taken" } });
	});
}
