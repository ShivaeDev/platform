import { Effect } from "effect";
import { expect } from "vitest";
import { MissingScreenPending } from "#screenDriver.ts";
import { roleScreen } from "#test/roleScreen.ts";
import { screenApp } from "#test/screenApp.ts";

roleScreen.it("acts on and reads a screen without a pending signal", [], function* ({ click, enter, submit, find, text, value, accessible }) {
	yield* click({ name: "Save", role: "button" });
	expect(text({ name: "Result", role: "status" })).toBe("Saved");
	yield* enter({ name: "Email", role: "textbox" }, "alice@example.test");
	expect(value("#email")).toBe("alice@example.test");
	yield* submit({ name: "Profile", role: "form" });
	expect(text("output")).toBe("Submitted alice@example.test");
	const found = yield* find({ name: /^save$/iu, role: "button" });
	expect(accessible(found)).toEqual({ name: "Save", role: "button" });
	expect(accessible("#email")).toEqual({ name: "Email", role: "textbox" });
});

screenApp.it("fails settlement immediately without a pending signal while a request is held", [], function* ({ holdNews, withoutPending, text }) {
	const held = yield* holdNews();
	yield* withoutPending.click("#load");
	yield* held.waiting;
	expect(text("output")).toBe("Loading");
	const error = Effect.runSync(Effect.flip(withoutPending.settle({ timeoutMs: 60_000 })));
	expect(error).toBeInstanceOf(MissingScreenPending);
	expect(error._tag).toBe("MissingScreenPending");
	expect(error.message).toContain("pending option");
	expect(error.message).toContain("Supply pending: () => boolean");
});

screenApp.it("fails settlement immediately without a pending signal even on an idle screen", [], ({ withoutPending }) => {
	expect(withoutPending.text("output")).toBe("Ready");
	const error = Effect.runSync(Effect.flip(withoutPending.settle({ timeoutMs: 60_000 })));
	expect(error).toBeInstanceOf(MissingScreenPending);
});
