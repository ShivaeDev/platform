import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { journalScreenOpen, subjectScreen } from "#test/bound-subject/story.tsx";

subjectScreen.it(
	"a screen's action and form over the client bound to dana write dana's journal while its plain client shows the coach's own",
	[journalScreenOpen],
	function* ({ journal, logsRanFiveK, writes }) {
		yield* outcomes([
			["the coach's own journal", () => journal("own"), "coach: "],
			["dana's journal", () => journal("dana"), "dana: "],
		]);

		yield* logsRanFiveK();
		yield* writes("Slept 8h");

		yield* outcomes([
			["dana's journal", () => journal("dana"), "dana: Ran 5k, Slept 8h"],
			["the coach's own journal", () => journal("own"), "coach: "],
		]);
	},
);
