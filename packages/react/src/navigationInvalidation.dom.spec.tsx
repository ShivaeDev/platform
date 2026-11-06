import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { loaderScreen } from "#test/loaderScreen.tsx";
import { noteLeftAfterShowing } from "#test/loaderTraits.ts";

loaderScreen.it(
	"returning after a rename shows the kept title while waiting, then the fresh title",
	[noteLeftAfterShowing("Original note")],
	function* ({ firstRenders, nextReadWaits, rename, respond, returnToNote, shownTitle, stale }) {
		yield* rename("Changed note");
		yield* nextReadWaits();
		const before = (yield* firstRenders()).length;

		yield* returnToNote();

		yield* outcomes([
			["shown title", shownTitle, "Original note"],
			["stale", stale, true],
		]);

		yield* respond("Changed note");

		yield* outcomes([
			[
				"renders since the visit",
				() => Effect.map(firstRenders(), (titles) => [...new Set(titles.slice(before))]),
				["Original note", "Changed note"],
			],
			["shown title", shownTitle, "Changed note"],
			["stale", stale, false],
		]);
	},
);
