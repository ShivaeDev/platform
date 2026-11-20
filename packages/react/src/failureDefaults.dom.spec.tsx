import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failureScreen, failures } from "#test/failure-defaults/story.tsx";

failures.it(
	"a command rejected with a shared Conflict shows the server's message with no failure handler",
	[failureScreen()],
	function* ({ notices, press, serverAnswers }) {
		yield* serverAnswers("Conflict");

		yield* press("Rename");

		expect(yield* notices()).toEqual(["Someone else saved this draft"]);
	},
);

failures.it("a command rejected with NotFound shows the server's message", [failureScreen()], function* ({ notices, press, serverAnswers }) {
	yield* serverAnswers("NotFound");

	yield* press("Rename");

	expect(yield* notices()).toEqual(["The draft is gone"]);
});

failures.it(
	"a command rejected with the app's own SubtitleRejected shows what its handler returns",
	[failureScreen()],
	function* ({ notices, press, serverAnswers }) {
		yield* serverAnswers("SubtitleRejected");

		yield* press("Rename");

		expect(yield* notices()).toEqual(["Draft: The subtitle is too long"]);
	},
);

failures.it(
	"a command rejected with Unauthorized asks the session to recheck and shows the server's message",
	[failureScreen()],
	function* ({ notices, press, rechecks, serverAnswers }) {
		yield* serverAnswers("Unauthorized");

		yield* press("Rename");

		yield* outcomes([
			["notices", () => notices(), ["Sign in to continue"]],
			["rechecks", () => rechecks(), "once"],
		]);
	},
);

failures.it("a silent command shows nothing when it is rejected", [failureScreen()], function* ({ notices, press, serverAnswers }) {
	yield* serverAnswers("Conflict");

	yield* press("Rename quietly");

	expect(yield* notices()).toEqual([]);
});

failures.it(
	"a command that words Conflict itself shows its own words instead of the server's",
	[failureScreen()],
	function* ({ notices, press, serverAnswers }) {
		yield* serverAnswers("Conflict");

		yield* press("Rename with its own wording");

		expect(yield* notices()).toEqual(["Someone else renamed it first"]);
	},
);

failures.it(
	"a command whose handler answers silent for SubtitleRejected shows nothing for it",
	[failureScreen()],
	function* ({ notices, press, serverAnswers }) {
		yield* serverAnswers("SubtitleRejected");

		yield* press("Rename with its own wording");

		expect(yield* notices()).toEqual([]);
	},
);

failures.it(
	"a command that loses its connection reaches the failure host once although two hooks hold the operation",
	[failureScreen()],
	function* ({ notices, press }) {
		yield* press("Rename offline");

		expect(yield* notices()).toEqual(["Could not reach the server. Check your connection and try again."]);
	},
);

failures.it("a command whose server dies reaches the failure host once without its cause", [failureScreen()], function* ({ notices, press }) {
	yield* press("Rename with a dying server");

	expect(yield* notices()).toEqual(["Something went wrong. Try again."]);
});

failures.it(
	"the failure host words a lost connection the way the application configured it",
	[failureScreen({ hostWording: (failure) => ({ message: `Offline (${failure.kind})` }) }, "whose failure host words failures by kind")],
	function* ({ notices, press }) {
		yield* press("Rename offline");

		expect(yield* notices()).toEqual(["Offline (connection)"]);
	},
);

failures.it(
	"a form save rejected with a Conflict on title shows it on the title field, not as a notice",
	[failureScreen()],
	function* ({ fieldError, notices, press, serverAnswers }) {
		yield* serverAnswers("Conflict on title");

		yield* press("Save form");

		yield* outcomes([
			["title error", () => fieldError(), "That title is taken"],
			["notices", () => notices(), []],
		]);
	},
);

failures.it(
	"a form save rejected with a Conflict naming no field shows the server's message as a notice",
	[failureScreen()],
	function* ({ fieldError, notices, press, serverAnswers }) {
		yield* serverAnswers("Conflict");

		yield* press("Save form");

		yield* outcomes([
			["title error", () => fieldError(), ""],
			["notices", () => notices(), ["Someone else saved this draft"]],
		]);
	},
);

failures.it(
	"a form save rejected with the app's own SubtitleRejected lands where its handler puts it",
	[failureScreen()],
	function* ({ fieldError, notices, press, serverAnswers }) {
		yield* serverAnswers("SubtitleRejected");

		yield* press("Save form");

		yield* outcomes([
			["title error", () => fieldError(), "The subtitle is too long"],
			["notices", () => notices(), []],
		]);
	},
);

failures.it("a form save that dies reaches the failure host once", [failureScreen()], function* ({ notices, press }) {
	yield* press("Save with a dying server");

	expect(yield* notices()).toEqual(["Something went wrong. Try again."]);
});

failures.it("a query view without a failure renderer shows the server's message with Retry", [failureScreen()], function* ({ note }) {
	expect(yield* note()).toEqual(["Draft 7 is gone Retry"]);
});

failures.it(
	"Retry in the default query failure shows the default Loading… beside the failure while it reads again",
	[failureScreen()],
	function* ({ note, retry }) {
		yield* retry();

		expect(yield* note()).toEqual(["Loading…", "Draft 7 is gone Retry"]);
	},
);

failures.it(
	"Retry in the default query failure reads the query again and shows its data",
	[failureScreen()],
	function* ({ answerReread, note, retry }) {
		yield* retry();

		yield* answerReread();

		expect(yield* note()).toEqual(["Quarterly report"]);
	},
);

failures.it(
	"the application's query view defaults replace the default failure rendering",
	[failureScreen({ queryDefaults: true }, "under the application's query view defaults")],
	function* ({ note }) {
		expect(yield* note()).toEqual(["This draft could not be opened"]);
	},
);

failures.it(
	"a command that answers SubtitleRejected with the message shorthand shows the server's message",
	[failureScreen()],
	function* ({ notices, press, serverAnswers }) {
		yield* serverAnswers("SubtitleRejected");

		yield* press("Rename with the server's words");

		expect(yield* notices()).toEqual(["The subtitle is too long"]);
	},
);

failures.it(
	"a command whose SubtitleRejected handler returns silent shows nothing for it",
	[failureScreen()],
	function* ({ notices, press, serverAnswers }) {
		yield* serverAnswers("SubtitleRejected");

		yield* press("Rename with a quiet handler");

		expect(yield* notices()).toEqual([]);
	},
);

failures.it(
	"a command failing with ServiceUnavailable reaches the failure host with the server's message",
	[failureScreen()],
	function* ({ notices, outageIs, press }) {
		yield* outageIs("ServiceUnavailable");

		yield* press("Rename during an outage");

		expect(yield* notices()).toEqual(["Drafts are down for maintenance"]);
	},
);

failures.it(
	"a command failing with AuthUnavailable reaches the failure host as unavailable with the server's message",
	[failureScreen({ hostWording: (failure) => ({ message: `${failure.kind}: ${failure.message}` }) }, "whose failure host shows the kind")],
	function* ({ notices, outageIs, press }) {
		yield* outageIs("AuthUnavailable");

		yield* press("Rename during an outage");

		expect(yield* notices()).toEqual(["unavailable: Sign-in is unavailable right now"]);
	},
);

failures.it(
	"a command failing with InternalServerError reaches the failure host with the server's redacted message",
	[failureScreen()],
	function* ({ notices, outageIs, press }) {
		yield* outageIs("InternalServerError");

		yield* press("Rename during an outage");

		expect(yield* notices()).toEqual(["The server could not finish the rename"]);
	},
);

failures.it(
	"an undoable change rejected with a shared Conflict shows the server's message with no failure handler",
	[failureScreen()],
	function* ({ notices, press, serverAnswers }) {
		yield* serverAnswers("Conflict");

		yield* press("Rename with undo");

		expect(yield* notices()).toEqual(["Someone else saved this draft"]);
	},
);

failures.it(
	"an undoable change hands its own input to the SubtitleRejected handler",
	[failureScreen()],
	function* ({ notices, press, serverAnswers }) {
		yield* serverAnswers("SubtitleRejected");

		yield* press("Rename with undo");

		expect(yield* notices()).toEqual(["Draft kept its title: The subtitle is too long"]);
	},
);
