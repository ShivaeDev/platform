import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { saves, unauthorizedSave, unauthorizedSaveAnswered } from "#test/saveStories.ts";

for (const kind of ["create", "editor"] as const) {
	saves.it(`an Unauthorized ${kind} save asks the session owner to recheck once`, [unauthorizedSave(kind)], function* ({ rechecks, submit, type }) {
		yield* type("Unsaved order");
		expect(yield* rechecks()).toEqual([]);

		yield* submit();

		expect(yield* rechecks()).toEqual(["expired-session"]);
	});

	saves.it(
		`an Unauthorized ${kind} save keeps the typed draft unsaved beside its Unauthorized failure`,
		[unauthorizedSave(kind)],
		function* ({ draft, failure, status, submit, type }) {
			yield* type("Unsaved order");

			yield* submit();

			yield* outcomes({
				draft: [draft(), "Unsaved order"],
				failure: [failure(), "Unauthorized: Session expired before saving"],
				status: [status(), "Unsaved changes"],
			});
		},
	);

	saves.it(
		`after an Unauthorized ${kind} save, rendering again and typing ask for no second recheck`,
		[unauthorizedSaveAnswered(kind)],
		function* ({ rechecks, rerender, type }) {
			yield* rerender();
			yield* type("Still editing");

			expect(yield* rechecks()).toEqual(["expired-session"]);
		},
	);
}
