import { expect } from "vitest";
import { attempt } from "#test/attempt.ts";
import { screenApp } from "#test/screenApp.ts";

screenApp.it("refuses to settle at once without a pending signal while a request is held", [], function* ({ holdNews, text, withoutPending }) {
	const held = yield* holdNews();
	yield* withoutPending.click("#load");
	yield* held.waiting;
	expect(text("output")).toBe("Loading");

	expect(yield* attempt(withoutPending.settle({ timeoutMs: 60_000 }))).toBe(
		[
			"failed with MissingScreenPending: Cannot settle the screen without the pending option.",
			"help: Supply pending: () => boolean that reads the application's pending work and stays true until its resulting screen work is ready to render.",
		].join("\n"),
	);
});
