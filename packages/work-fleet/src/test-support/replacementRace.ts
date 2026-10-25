import { answers } from "#test/answerHost.ts";
import { configureReplacementRace, type Window } from "#test/answerReplacement.ts";

export function replacementRace(window: Window = "after-record") {
	return answers.trait("configuration", `the Board replaces a decision ${window}`, (engine) => {
		configureReplacementRace(engine, window);
	});
}
