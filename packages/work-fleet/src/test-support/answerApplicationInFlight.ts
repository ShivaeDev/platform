import { configureAnswerApplicationRace } from "#test/answerApplicationRace.ts";
import { host } from "#test/hostStory.ts";

export function answerApplicationInFlight() {
	return host.trait("configuration", "answer application can pause after reading its Board response", configureAnswerApplicationRace);
}
