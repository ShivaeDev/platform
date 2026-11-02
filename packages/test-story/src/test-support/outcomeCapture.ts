import { Cause, Data, Effect } from "effect";
import { captureOutcome } from "#captureOutcome.ts";
import { storyKit } from "#storyKit.ts";

class ReadDenied extends Data.TaggedError("ReadDenied")<{ readonly reason: string }> {}

const renderers = {
	onDefect: (defect: unknown) => `reader crashed: ${defect instanceof Error ? defect.message : String(defect)}`,
	onFailure: (error: ReadDenied) => `read refused: ${error.reason}`,
	onInterrupt: () => "read cancelled",
	onSuccess: <A>(value: A) => value,
};

export const outcomeCapture = storyKit({
	create: () => ({}),
	name: "outcome capture",
	stages: [],
	verbs: (_engine, story) => ({
		cancel: () => {
			story.tell("the read is interrupted");
			return captureOutcome(Effect.interrupt, renderers);
		},
		crash: (message: string) => {
			story.tell(`the reader crashes with ${message}`);
			return captureOutcome(Effect.die(new Error(message)), renderers);
		},
		crashWhileCancelled: (message: string) => {
			story.tell(`the cancelled read crashes with ${message}`);
			return captureOutcome(Effect.failCause(Cause.combine(Cause.interrupt(1), Cause.die(new Error(message)))), renderers);
		},
		failWithDefect: (reason: string) => {
			story.tell(`the reader fails with ${reason} and a defect`);
			return captureOutcome(Effect.failCause(Cause.combine(Cause.fail(new ReadDenied({ reason })), Cause.die("reader crashed"))), renderers);
		},
		read: (value: { readonly title: string }) => {
			story.tell(`the reader returns ${value.title}`);
			return captureOutcome(Effect.succeed(value), renderers);
		},
		refuse: (reason: string) => {
			story.tell(`the reader refuses because ${reason}`);
			return captureOutcome(Effect.fail(new ReadDenied({ reason })), renderers);
		},
	}),
});
