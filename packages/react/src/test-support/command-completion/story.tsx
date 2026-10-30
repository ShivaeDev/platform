import { Deferred, Effect } from "effect";
import { startTransition } from "react";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { timesWords } from "#test/outcomeWords.ts";
import { clickButton, type Screen } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { completionClient, Rejected, Unauthorized } from "./client.ts";
import { type CompletionScreen, CompletionView } from "./view.tsx";

type Title = "first" | "second";

interface State {
	current: CompletionScreen;
	view?: Rendered;
}

function view(state: State) {
	if (!state.view) {
		throw new Error("Command screen is not open");
	}
	return state.view;
}

function output(state: State) {
	const found = view(state).container.querySelector("output");
	if (!found) {
		throw new Error("Command screen has no output");
	}
	return found;
}

function finish(
	state: State,
	screen: Screen,
	title: Title,
	line: string,
	answer: (gate: ReturnType<typeof state.current.client.command>["gate"]) => void,
) {
	const { finished, gate } = state.current.client.command(title);
	return screen.act(line, async () => {
		answer(gate);
		await Effect.runPromise(Deferred.await(finished));
	});
}

function commandVerbs(state: State, screen: Screen) {
	return {
		commit: (changes: Partial<CompletionScreen>, line: string) =>
			screen.act(line, async () => {
				state.current = { ...state.current, ...changes };
				await view(state).render(<CompletionView state={state.current} />);
			}),
		complete: (title: Title, value: string) =>
			finish(state, screen, title, `the server completes ${title} with ${value}`, (gate) => Deferred.doneUnsafe(gate, Effect.succeed(value))),
		dispatch: (title: Title) =>
			screen.act(`dispatch ${title}`, async () => {
				clickButton(view(state).container, title);
				await Effect.runPromise(Deferred.await(state.current.client.command(title).arrived));
			}),
		reject: (title: Title, failure: "Rejected" | "Unauthorized") =>
			finish(state, screen, title, `the server rejects ${title} as ${failure}`, (gate) =>
				Deferred.doneUnsafe(gate, Effect.fail(failure === "Unauthorized" ? new Unauthorized() : new Rejected({ reason: "Locked" }))),
			),
	};
}

export const commands = storyKit(
	screenKit(
		"command completions",
		(): State => ({
			current: {
				attempts: [],
				callback: "original",
				client: completionClient(),
				concurrent: false,
				defect: false,
				notices: [],
				rechecks: 0,
				session: "alice",
				uninterruptible: false,
			},
		}),
		(state, screen) => {
			const verbs = commandVerbs(state, screen);
			return {
				...verbs,
				actionPending: () => Effect.sync(() => output(state).getAttribute("data-pending")),
				defectShown: () => Effect.sync(() => view(state).container.querySelector("pre")?.textContent?.split("\n")[0]),
				finished: () => Effect.sync(() => [...state.current.client.finished]),
				invalidations: () => Effect.sync(() => state.current.client.invalidations()),
				listPending: () => Effect.sync(() => output(state).getAttribute("data-query-pending")),
				listReads: () => Effect.sync(() => state.current.client.reads()),
				notices: () => Effect.sync(() => [...state.current.notices]),
				rechecks: () => Effect.sync(() => timesWords(state.current.rechecks)),
				renderAgain: () => verbs.commit({}, "render the command screen again"),
				renderedCallbacks: () => Effect.sync(() => [...state.current.attempts]),
				startAbandonedRender: () =>
					screen.act("start a render with an uncommitted callback that never commits", () => {
						const next = { ...state.current, callback: "uncommitted", suspend: new Promise<void>(() => undefined) };
						startTransition(() => {
							void view(state).render(<CompletionView state={next} />);
						});
					}),
				switchCallback: (callback: string) => verbs.commit({ callback }, `commit a render whose completion callback is ${callback}`),
			};
		},
	),
);

type Options = Partial<Pick<CompletionScreen, "concurrent" | "defect" | "uninterruptible">>;

function* open({ screen, state }: { readonly screen: Screen; readonly state: State }, options: Options) {
	state.current = { ...state.current, ...options };
	state.view = yield* screen.open(<CompletionView state={state.current} />);
}

function optionWords(options: Options) {
	const words = [
		options.concurrent && "concurrent",
		options.uninterruptible && "uninterruptible",
		options.defect && "whose success callback throws",
	].filter(Boolean);
	return words.length === 0 ? "" : ` (${words.join(", ")})`;
}

export function firstHeld(options: Options = {}) {
	return commands.trait("screen", `alice's command first${optionWords(options)} is held by the server`, function* (engine) {
		yield* open(engine, options);
		yield* commandVerbs(engine.state, engine.screen).dispatch("first");
	});
}

export function firstAndSecondHeld() {
	return commands.trait("screen", "alice's concurrent commands first and second are both held by the server", function* (engine) {
		yield* open(engine, { concurrent: true });
		const { dispatch } = commandVerbs(engine.state, engine.screen);
		yield* dispatch("first");
		yield* dispatch("second");
	});
}

export function secondFinishedFirstHeld(finished: "completed" | "Unauthorized") {
	return commands.trait(
		"screen",
		`alice's concurrent command second was ${finished === "completed" ? "completed with B" : "rejected as Unauthorized"} while first is held`,
		function* (engine) {
			yield* open(engine, { concurrent: true });
			const { complete, dispatch, reject } = commandVerbs(engine.state, engine.screen);
			yield* dispatch("first");
			yield* dispatch("second");
			yield* finished === "completed" ? complete("second", "B") : reject("second", "Unauthorized");
		},
	);
}

export function firstSupersededBySecond() {
	return commands.trait("screen", "alice dispatched second while first was held, superseding first", function* (engine) {
		yield* open(engine, {});
		const { dispatch } = commandVerbs(engine.state, engine.screen);
		yield* dispatch("first");
		yield* dispatch("second");
	});
}

export function firstHeldAcrossSessionChange(callback: "bob" | "original") {
	return commands.trait(
		"screen",
		`alice's uninterruptible command first is held while bob's session replaces hers${callback === "bob" ? " with bob's callback" : ""}`,
		function* (engine) {
			yield* open(engine, { uninterruptible: true });
			const { commit, dispatch } = commandVerbs(engine.state, engine.screen);
			yield* dispatch("first");
			yield* commit({ callback, session: "bob" }, "bob's session replaces alice's");
		},
	);
}

export function outgoingFinishedForBob() {
	return commands.trait("screen", "bob's session replaced alice's while her command first was held, and first then completed", function* (engine) {
		yield* open(engine, { uninterruptible: true });
		const { commit, complete, dispatch } = commandVerbs(engine.state, engine.screen);
		yield* dispatch("first");
		yield* commit({ callback: "bob", session: "bob" }, "bob's session replaces alice's");
		yield* complete("first", "A");
	});
}

export function firstFinished(finished: "completed" | "Unauthorized") {
	return commands.trait(
		"screen",
		`alice's command first was ${finished === "completed" ? "completed with A" : "rejected as Unauthorized"}`,
		function* (engine) {
			yield* open(engine, {});
			const { complete, dispatch, reject } = commandVerbs(engine.state, engine.screen);
			yield* dispatch("first");
			yield* finished === "completed" ? complete("first", "A") : reject("first", "Unauthorized");
		},
	);
}
