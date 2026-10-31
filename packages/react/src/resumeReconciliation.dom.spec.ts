import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveNotesRenamedWhileAway, liveNotesShown, liveStreamInterrupted, resumes } from "#test/resumeStories.ts";

for (const source of ["native", "browser"] as const) {
	resumes.it(
		`a ${source} resume shows changes made while away and keeps both live subscriptions`,
		[liveNotesRenamedWhileAway(source)],
		function* ({ liveResume, shown, subscriptions }) {
			expect(yield* shown()).toBe("One / Two");

			yield* liveResume(source);

			yield* outcomes([
				["shown", () => shown(), "Changed while away / Also changed while away"],
				["subscriptions", () => subscriptions(), ["open", "open"]],
			]);
		},
	);

	resumes.it(
		`a ${source} reconnect after an interrupted stream subscribes again and shows the change it missed`,
		[liveStreamInterrupted(source)],
		function* ({ liveReconnect, shown, subscriptions }) {
			expect(yield* subscriptions()).toEqual(["closed", "closed"]);

			yield* liveReconnect(source);

			yield* outcomes([
				["shown", () => shown(), "Changed while disconnected / Two"],
				["subscriptions", () => subscriptions(), ["closed", "closed", "open", "open"]],
			]);
		},
	);

	resumes.it(`closing a live ${source} screen closes its streams`, [liveNotesShown(source)], function* ({ close, subscriptions }) {
		expect(yield* subscriptions()).toEqual(["open", "open"]);

		yield* close();

		expect(yield* subscriptions()).toEqual(["closed", "closed"]);
	});
}

resumes.it("closing a live native screen removes its native resume listener", [liveNotesShown("native")], function* ({ close, nativeSubscription }) {
	expect(yield* nativeSubscription()).toBe("subscribed");

	yield* close();

	expect(yield* nativeSubscription()).toBe("released");
});
