import { Context, Effect, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { SessionReceipt } from "#session/schema.ts";
import { SessionService } from "#session/service.ts";
import { outcomeOf } from "#test/refusal.ts";
import { receipt, sessionHarness } from "#test/session.ts";

type Options = NonNullable<Parameters<typeof sessionHarness>[1]>;
interface SessionState {
	events: string[];
	options: Options;
	session: typeof SessionService.Service | undefined;
}
function receiptWords({ sessionId, turnId }: SessionReceipt) {
	return `turn ${turnId} on ${sessionId}`;
}
export const sessionStory = storyKit({
	after: {
		*transport(state) {
			state.session = Context.get(yield* Layer.build(sessionHarness(state.events, state.options)), SessionService);
		},
	},
	create: (): SessionState => ({ events: [], options: {}, session: undefined }),
	inspect: (state) => state.events,
	name: "Fleet session",
	stages: ["transport"],
	verbs: (state, story) => {
		const session = state.session;
		if (session === undefined) {
			throw new Error("The session service did not start");
		}
		const commands = {
			continue: () => {
				story.tell("continue the acknowledged session with a repair prompt");
				return outcomeOf(
					session.continue({ operationId: "repair", prompt: "repair", sessionId: receipt.sessionId }),
					(turn) => `continued ${receiptWords(turn)}`,
				);
			},
			interrupt: () => {
				story.tell("interrupt the acknowledged turn");
				return outcomeOf(session.interrupt(receipt), (turn) => `interrupted ${receiptWords(turn)}`);
			},
			observe: () => {
				story.tell("observe the acknowledged turn");
				return outcomeOf(session.observe(receipt), ({ execution, provisioning }) => `execution ${execution}, provisioning ${provisioning}`);
			},
			reconcile: () => {
				story.tell("reconcile the operation with the provider");
				return outcomeOf(session.reconcile({ operationId: "operation", ...receipt }), (turn) => `reconciled ${receiptWords(turn)}`);
			},
			start: () => {
				story.tell("start a journaled session");
				return outcomeOf(session.start({ cwd: "/synthetic", operationId: "operation", prompt: "work" }), (turn) => `started ${receiptWords(turn)}`);
			},
		};
		return {
			archive: () => {
				story.tell("archive the session");
				return outcomeOf(session.archive(receipt.sessionId), () => "archived");
			},
			commands,
			events: () => Effect.sync(() => [...state.events]),
		};
	},
});
export function transportDoes(options: Options) {
	return sessionStory.trait("transport", `the transport has ${Object.keys(options).join(", ")}`, (state) => {
		state.options = options;
	});
}
