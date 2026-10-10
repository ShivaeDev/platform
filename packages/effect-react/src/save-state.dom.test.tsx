import { Option } from "effect";
import { act } from "react";
import { expect, it } from "vitest";
import { saveSession } from "#test/saveSession.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

it("an Unauthorized create failure rechecks the session and preserves the draft and specific failure", async () => {
	const view = await saveSession();
	try {
		await act(async () => view.current().form.change("name", "Unsaved order"));
		await act(async () => view.current().save());
		expect(view.rechecks).toEqual(["expired-session"]);
		expect(Option.getOrNull(view.current().failure)).toBe(view.denied);
		expect(view.current().form.values.value).toEqual({ name: "Unsaved order" });
		expect(view.current().saving).toBe(false);
		expect(view.current().dirty).toBe(true);
		expect(Option.isNone(view.current().created)).toBe(true);
	} finally {
		await view.close();
	}
});
