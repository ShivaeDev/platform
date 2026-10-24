import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { supersedeQuestion } from "#test/supersedeQuestion.ts";

export function hostAcknowledgementVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		acknowledgementAttempts: () => {
			if (engine.acknowledgements === undefined) {
				throw new Error("Configure acknowledgement failures first");
			}
			return engine.acknowledgements.attempts;
		},
		acknowledgementsAvailable: () => {
			if (engine.acknowledgements === undefined) {
				throw new Error("Configure acknowledgement failures first");
			}
			tell("Board accepts acknowledgements again");
			engine.acknowledgements.unavailable = false;
		},
		supersedeQuestion: (...args: [Parameters<typeof supersedeQuestion>[1], string, boolean]) => {
			tell("a later Board turn supersedes the question acknowledgement");
			supersedeQuestion(engine.fixture.host.boardDir, ...args);
		},
	};
}
