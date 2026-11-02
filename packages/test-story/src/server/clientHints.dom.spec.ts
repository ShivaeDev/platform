import { expect } from "@effect/vitest";
import { hintScreen } from "#test/hintScreen.ts";

for (const source of ["empty", "idle"] as const) {
	hintScreen.it(
		`an ${source} activity stream ending fails the live hint wait with its typed reason`,
		[],
		function* ({ startWaiting, reportIdle, endActivity }) {
			const wait = yield* startWaiting();
			if (source === "idle") {
				yield* reportIdle();
			}
			expect(yield* wait.state).toBe("waiting");

			yield* endActivity();

			expect(yield* wait.finish).toBe(
				'Signal "next live hint" never arrived: the client activity stream ended.\nhelp: Keep the client activity stream open until the action delivers a live hint.',
			);
		},
	);
}

hintScreen.it("a live hint resolves the waiting screen before the activity stream ends", [], function* ({ startWaiting, deliverHint }) {
	const wait = yield* startWaiting();
	expect(yield* wait.state).toBe("waiting");

	yield* deliverHint();

	expect(yield* wait.finish).toBe("received");
});
