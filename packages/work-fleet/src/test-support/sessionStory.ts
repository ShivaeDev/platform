import { Context, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { SessionService } from "#session/service.ts";
import { sessionHarness } from "#test/session.ts";

type Options = NonNullable<Parameters<typeof sessionHarness>[1]>;
interface SessionState {
	events: string[];
	options: Options;
	session: typeof SessionService.Service | undefined;
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
		return {
			events: () => state.events,
			session: {
				archive: (...args: Parameters<typeof session.archive>) => {
					story.tell("archive the session");
					return session.archive(...args);
				},
				continue: (...args: Parameters<typeof session.continue>) => {
					story.tell("continue the session");
					return session.continue(...args);
				},
				interrupt: (...args: Parameters<typeof session.interrupt>) => {
					story.tell("interrupt the session");
					return session.interrupt(...args);
				},
				observe: (...args: Parameters<typeof session.observe>) => {
					story.tell("observe the session");
					return session.observe(...args);
				},
				reconcile: (...args: Parameters<typeof session.reconcile>) => {
					story.tell("reconcile the session");
					return session.reconcile(...args);
				},
				start: (...args: Parameters<typeof session.start>) => {
					story.tell("start a journaled session");
					return session.start(...args);
				},
			},
		};
	},
});
export function transportDoes(options: Options) {
	return sessionStory.trait("transport", `the transport has ${Object.keys(options).join(", ")}`, (state) => {
		state.options = options;
	});
}
