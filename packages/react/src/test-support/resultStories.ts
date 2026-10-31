import { Cause, Data, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { causeWords, dataWords, statusWords } from "./outcomeWords.ts";
import { resultSession } from "./resultSession.ts";
import { screenKit } from "./screenKit.ts";

type ResultKind = "query" | "action";
class Unauthorized extends Data.TaggedError("Unauthorized")<{ readonly message: string }> {}
interface State {
	answer: () => Effect.Effect<unknown, Unauthorized>;
	view?: Awaited<ReturnType<typeof resultSession<unknown, Unauthorized>>>;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("No result screen is open");
	}
	return state.view;
}
function verb(kind: ResultKind) {
	return kind === "query" ? "refresh the query" : "dispatch the action";
}

export const results = storyKit(
	screenKit(
		"result session screen",
		(): State => ({ answer: () => Effect.void }),
		(state, screen) => ({
			cause: () => Effect.sync(() => causeWords(current(state).current().cause)),
			data: () => Effect.sync(() => dataWords(current(state).current().data)),
			rechecks: () => Effect.sync(() => [...current(state).rechecks]),
			rerender: () => screen.act("the session's screen renders again", () => current(state).rerender()),
			run: () => screen.act("run the result again", () => current(state).execute()),
			status: () => Effect.sync(() => statusWords(current(state).current())),
		}),
	),
);

function opened(kind: ResultKind, line: string, answer: State["answer"], unauthorizedAfterFirst = false) {
	return results.trait("screen", line, function* ({ screen, state }) {
		const view = yield* screen.open();
		let answered = 0;
		state.answer = () => {
			answered += 1;
			return unauthorizedAfterFirst && answered > 1 ? Effect.fail(new Unauthorized({ message: "Session expired" })) : answer();
		};
		state.view = yield* Effect.promise(() => resultSession(view, kind, () => state.answer()));
		if (kind === "action") {
			yield* screen.act(verb(kind), () => current(state).execute());
		}
	});
}

export function answersUndefined(kind: ResultKind) {
	return opened(kind, `a ${kind} that answered with undefined`, () => Effect.void);
}

export function diesWithUnauthorizedShape(kind: ResultKind) {
	return opened(kind, `a ${kind} that died with an object tagged Unauthorized`, () => Effect.die({ _tag: "Unauthorized" }));
}

export function interrupted(kind: ResultKind) {
	return opened(kind, `a ${kind} that was interrupted`, () => Effect.failCause(Cause.interrupt()));
}

export function savedOrderThenUnauthorized(kind: ResultKind) {
	return opened(
		kind,
		`a ${kind} that answered Saved order, and whose next run fails with Unauthorized: Session expired`,
		() => Effect.succeed("Saved order"),
		true,
	);
}

export function unauthorizedOnce(kind: ResultKind) {
	return results.traits(
		savedOrderThenUnauthorized(kind),
		results.trait("screen", `the ${kind} ran again and failed with Unauthorized`, function* ({ screen, state }) {
			yield* screen.act("run the result again", () => current(state).execute());
		}),
	);
}
