import { Option } from "effect";
import { expect } from "vitest";
import { saveProbe, saves } from "#test/saveStories.ts";

for (const kind of ["create", "editor"] as const) {
	saves.it(
		`an Unauthorized ${kind} save rechecks once and preserves draft and typed failure`,
		[saveProbe(kind)],
		function* ({ save, type, submit, rerender }) {
			const view = save();

			expect(view.rechecks).toEqual([]);
			yield* type("Unsaved order");
			yield* submit();
			expect(view.rechecks).toEqual(["expired-session"]);
			expect(Option.getOrNull(view.current().failure)).toBe(view.denied);
			expect(view.form().values.value).toEqual({ name: "Unsaved order" });
			expect(view.current().saving).toBe(false);
			expect(view.current().dirty).toBe(true);
			const state = view.current();
			if ("created" in state) {
				expect(Option.isNone(state.created)).toBe(true);
			} else {
				expect(Option.getOrNull(state.query.data)).toEqual({ name: "Saved order" });
				expect(Option.isNone(state.query.cause)).toBe(true);
			}
			yield* rerender();
			yield* type("Still editing");
			expect(view.rechecks).toEqual(["expired-session"]);
			expect(view.form().values.value).toEqual({ name: "Still editing" });
			expect(Option.getOrNull(view.current().failure)).toBe(view.denied);
		},
	);
}
