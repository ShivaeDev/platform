import { Option } from "effect";
import { act } from "react";
import { expect, it } from "vitest";
import { expectNoReactWarnings } from "#client/testing.ts";
import { saveSession } from "#test/saveSession.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
it.each(["create", "editor"] as const)("an Unauthorized %s save rechecks once and preserves the draft and specific failure", async (kind) => {
	const view = await saveSession(kind);
	try {
		expect(view.rechecks).toEqual([]);
		await act(async () => view.form().change("name", "Unsaved order"));
		await act(async () => view.current().save());
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
		await view.render();
		await act(async () => view.form().change("name", "Still editing"));
		expect(view.rechecks).toEqual(["expired-session"]);
		expect(view.form().values.value).toEqual({ name: "Still editing" });
		expect(Option.getOrNull(view.current().failure)).toBe(view.denied);
	} finally {
		await view.close();
	}
});
