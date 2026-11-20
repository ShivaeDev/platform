import { expect } from "vitest";
import { failureScreen, failures } from "#test/failure-defaults/story.tsx";

failures.it(
	"a command's refusal notice goes without Dismiss when the same command later succeeds",
	[failureScreen()],
	function* ({ answerReread, notices, press, serverAnswers }) {
		yield* serverAnswers("Conflict");
		yield* press("Rename");
		expect(yield* notices()).toEqual(["Someone else saved this draft"]);
		yield* serverAnswers("Renamed");
		yield* answerReread();

		yield* press("Rename");

		expect(yield* notices()).toEqual([]);
	},
);

failures.it(
	"a form's refusal notice goes without Dismiss when the next save succeeds",
	[failureScreen()],
	function* ({ answerReread, notices, press, serverAnswers }) {
		yield* serverAnswers("Conflict");
		yield* press("Save form");
		expect(yield* notices()).toEqual(["Someone else saved this draft"]);
		yield* serverAnswers("Renamed");
		yield* answerReread();

		yield* press("Save form");

		expect(yield* notices()).toEqual([]);
	},
);

failures.it(
	"a refusal notice stays when a different command succeeds",
	[failureScreen()],
	function* ({ answerReread, notices, press, serverAnswers }) {
		yield* serverAnswers("Conflict");
		yield* press("Rename");
		yield* serverAnswers("Renamed");
		yield* answerReread();

		yield* press("Rename with its own wording");

		expect(yield* notices()).toEqual(["Someone else saved this draft"]);
	},
);

failures.it(
	"an outage notice from the failure host goes when the same command later succeeds",
	[failureScreen()],
	function* ({ notices, outageEnds, outageIs, press }) {
		yield* outageIs("ServiceUnavailable");
		yield* press("Rename during an outage");
		expect(yield* notices()).toEqual(["Drafts are down for maintenance"]);
		yield* outageEnds();

		yield* press("Rename during an outage");

		expect(yield* notices()).toEqual([]);
	},
);
