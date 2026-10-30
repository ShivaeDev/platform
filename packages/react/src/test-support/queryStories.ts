import { Cause, Deferred, Effect, Exit, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { QueryOptions } from "#client/resultState.ts";
import { heldReads, queryView, type Unavailable } from "./queryView.ts";
import { clickButton, type Screen, screenWarnings, typeInput } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

interface State {
	marked?: { readonly content: Element | null; readonly shell: Element | null };
	native?: Atom.Writable<AsyncResult.AsyncResult<string, Unavailable>> | undefined;
	payload: string;
	readonly reads: ReturnType<typeof heldReads>;
	view?: Awaited<ReturnType<typeof queryView>>;
}

function view(state: State) {
	if (!state.view) {
		throw new Error("The query screen is not open");
	}
	return state.view;
}

function native(state: State) {
	if (!state.native) {
		throw new Error("Expected a writable native query");
	}
	return state.native;
}

function text(state: State, selector: string) {
	return view(state).container.querySelector(selector)?.textContent ?? "none";
}

function marked(state: State, key: "content" | "shell", selector: string) {
	const current = view(state).container.querySelector(selector);
	if (current === null) {
		return "missing";
	}
	return current === state.marked?.[key] ? "original" : "replaced";
}

function queryVerbs(state: State, screen: Screen) {
	function settle(label: string, line: string, result: Exit.Exit<string, Unavailable>) {
		return screen.act(line, () => Effect.runPromise(Deferred.done(state.reads.held(label), result)));
	}
	return {
		alert: () => Effect.sync(() => text(state, '[role="alert"]')),
		answer: (label: string, value: string) => settle(label, `read ${label} answers ${value}`, Exit.succeed(value)),
		changePayload: (payload: string, options?: QueryOptions) => {
			state.reads.next(payload);
			state.payload = payload;
			const kept = options?.keepPreviousData === undefined ? "" : ` with keepPreviousData ${options.keepPreviousData}`;
			return screen.act(`change the query's payload to ${payload}${kept}`, () => view(state).render(state.reads.queries(payload), options));
		},
		clickRetry: () => {
			state.reads.next("retry");
			return screen.act("click Retry", () => clickButton(view(state).container, "Retry"));
		},
		crash: () => Effect.sync(() => text(state, "[data-crash]")),
		die: (label: string, defect: unknown) => settle(label, `read ${label} dies`, Exit.die(defect)),
		elements: () => Effect.sync(() => ({ content: marked(state, "content", "article"), shell: marked(state, "shell", '[name="shell"]') })),
		fail: (label: string, message: string) =>
			settle(label, `read ${label} fails as Unavailable: ${message}`, Exit.fail({ _tag: "Unavailable", message })),
		field: (name: string) => Effect.sync(() => view(state).container.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? "missing"),
		interruptedReads: () =>
			Effect.promise(async () => {
				await act(async () => undefined);
				return [...state.reads.interrupted];
			}),
		invalidate: (label: string) => {
			state.reads.next(label);
			return screen.act(`invalidate the reports, starting read ${label}`, () => view(state).invalidate(state.reads.invalidation));
		},
		loading: () => Effect.sync(() => text(state, '[role="status"]')),
		*moveToAnotherRegistry() {
			state.reads.next("first");
			screen.tell("render the query from another registry");
			const registry = yield* Effect.acquireRelease(
				Effect.sync(() => AtomRegistry.make()),
				(owner) => Effect.promise(view(state).unmount).pipe(Effect.ensuring(Effect.sync(() => owner.dispose()))),
			);
			yield* Effect.promise(() => act(() => view(state).render(state.reads.queries("first"), { keepPreviousData: true }, registry)));
		},
		nativeAnswer: () => Effect.sync(() => Option.getOrElse(AsyncResult.value(view(state).registry.get(native(state))), () => "none")),
		nativeFails: (message: string) =>
			screen.act(`the native query fails as Unavailable: ${message}`, () => {
				view(state).registry.set(native(state), AsyncResult.failure(Cause.fail({ _tag: "Unavailable", message } as const)));
			}),
		nativeRefreshDropsAnswer: () =>
			screen.act("the native query starts a refresh whose result drops its previous answer", () => {
				view(state).registry.set(native(state), AsyncResult.initial(true));
			}),
		refresh: (label = "refresh") => {
			state.reads.next(label);
			return screen.act(`click Refresh, starting read ${label}`, () => {
				const button = view(state).container.querySelector("button");
				if (!button) {
					throw new Error("Missing query refresh button");
				}
				button.click();
			});
		},
		shown: () => Effect.sync(() => view(state).shown()),
		shownAnswer: () => Effect.sync(() => text(state, "output")),
		turnOffRetention: () =>
			screen.act("turn keepPreviousData off for the current payload", () =>
				view(state).render(state.reads.queries(state.payload), { keepPreviousData: false }),
			),
		type: (name: string, value: string) => screen.act(`type ${value} into ${name}`, () => typeInput(view(state).container, name, value)),
	};
}

export const queries = storyKit(screenKit("query screen", (): State => ({ payload: "first", reads: heldReads() }), queryVerbs));

interface Engine {
	readonly screen: Screen;
	readonly state: State;
}

function* openProbe({ screen, state }: Engine, options: QueryOptions) {
	const root = yield* screen.open();
	state.reads.next("first");
	state.view = yield* Effect.promise(() => queryView(root, state.reads.queries("first"), options));
}

function retention(options: QueryOptions) {
	return options.keepPreviousData === undefined ? "default retention" : `keepPreviousData ${options.keepPreviousData}`;
}

export function queryAnswered(answer: string, options: QueryOptions = {}) {
	return queries.trait("screen", `a query with ${retention(options)} showed its first read's answer ${answer}`, function* (engine) {
		yield* openProbe(engine, options);
		yield* queryVerbs(engine.state, engine.screen).answer("first", answer);
	});
}

type Verbs = ReturnType<typeof queryVerbs>;
type Steps = (verbs: Verbs) => Generator<Effect.Effect<unknown, unknown, never>, void>;

function queryAfter(line: string, options: QueryOptions, steps: Steps) {
	return queries.trait("screen", line, function* (engine) {
		yield* openProbe(engine, options);
		yield* steps(queryVerbs(engine.state, engine.screen));
	});
}

const kept = { keepPreviousData: true };

function* firstThenSecond(verbs: Verbs, options?: QueryOptions) {
	yield* verbs.answer("first", "First payload");
	yield* verbs.changePayload("second", options);
}

export function payloadChanging(options: QueryOptions = kept) {
	return queryAfter(`a query with ${retention(options)} answered First payload and changed to payload second`, options, (verbs) =>
		firstThenSecond(verbs),
	);
}

export function keptPayloadRefreshing() {
	return queryAfter(
		"a query with keepPreviousData true answered First payload, payload second failed and its refresh waits",
		kept,
		function* (verbs) {
			yield* firstThenSecond(verbs);
			yield* verbs.fail("second", "New payload unavailable");
			yield* verbs.refresh();
		},
	);
}

export function refreshSupersededByPayload() {
	return queryAfter(
		"a query with keepPreviousData true answered First payload, then payload third superseded the waiting refresh of payload second",
		kept,
		function* (verbs) {
			yield* firstThenSecond(verbs);
			yield* verbs.fail("second", "New payload unavailable");
			yield* verbs.refresh();
			yield* verbs.changePayload("third");
		},
	);
}

export function retentionTurnedOff() {
	return queryAfter(
		"a query with keepPreviousData true answered First payload, changed to payload second, then turned keepPreviousData off",
		kept,
		function* (verbs) {
			yield* firstThenSecond(verbs);
			yield* verbs.turnOffRetention();
		},
	);
}

export function invalidatedOnce() {
	return queryAfter("a query answered Last success and an invalidation started a re-read", {}, function* (verbs) {
		yield* verbs.answer("first", "Last success");
		yield* verbs.invalidate("first invalidation");
	});
}

export function invalidatedTwice() {
	return queryAfter("a query answered Last success, then a second invalidation superseded the first one's re-read", {}, function* (verbs) {
		yield* verbs.answer("first", "Last success");
		yield* verbs.invalidate("first invalidation");
		yield* verbs.invalidate("second invalidation");
	});
}

export function refreshFailed() {
	return queryAfter("a query answered Last success and its refresh failed as Unavailable: Offline", {}, function* (verbs) {
		yield* verbs.answer("first", "Last success");
		yield* verbs.refresh();
		yield* verbs.fail("refresh", "Offline");
	});
}

export function retryingAfterFailedRefresh() {
	return queryAfter("a query answered Last success, its refresh failed as Unavailable: Offline and a retry waits", {}, function* (verbs) {
		yield* verbs.answer("first", "Last success");
		yield* verbs.refresh();
		yield* verbs.fail("refresh", "Offline");
		yield* verbs.refresh("retry");
	});
}

export function nativeQueryAnswered(answer: string) {
	return queries.trait("screen", `a native query showed its answer ${answer}`, function* ({ screen, state }) {
		const root = yield* screen.open();
		state.native = Atom.make<AsyncResult.AsyncResult<string, Unavailable>>(AsyncResult.success(answer));
		state.view = yield* Effect.promise(() => queryView(root, native(state)));
	});
}

export function nativeQueryRefreshing(answer: string) {
	return queries.trait("screen", `a native query showed ${answer} and started a refresh that dropped it`, function* (engine) {
		const { screen, state } = engine;
		const root = yield* screen.open();
		state.native = Atom.make<AsyncResult.AsyncResult<string, Unavailable>>(AsyncResult.success(answer));
		state.view = yield* Effect.promise(() => queryView(root, native(state)));
		yield* queryVerbs(state, screen).nativeRefreshDropsAnswer();
	});
}

function feedbackAfter(line: string, steps: Steps | undefined, defect?: Error) {
	return queries.trait("screen", `query feedback inside an application shell and error boundary: ${line}`, function* ({ screen, state }) {
		const root = yield* screen.open(null, defect ? { onCaughtError: screenWarnings.expectCaughtError((error) => error === defect) } : undefined);
		state.reads.next("first");
		state.view = yield* Effect.promise(() => queryView(root, state.reads.queries("first"), {}, true));
		if (steps) {
			yield* steps(queryVerbs(state, screen));
		}
		state.marked = { content: root.container.querySelector("article"), shell: root.container.querySelector('[name="shell"]') };
	});
}

export function feedbackWaiting(defect?: Error) {
	return feedbackAfter("the first read waits", undefined, defect);
}

export function feedbackFirstReadFailed() {
	return feedbackAfter("the shell input holds Shell draft and the first read failed as Unavailable: Offline", function* (verbs) {
		yield* verbs.type("shell", "Shell draft");
		yield* verbs.fail("first", "Offline");
	});
}

export function feedbackRefreshFailed() {
	return feedbackAfter(
		"the first read answered Last success, the content input holds Unsaved input and a refresh failed as Unavailable: Offline",
		function* (verbs) {
			yield* verbs.answer("first", "Last success");
			yield* verbs.type("local", "Unsaved input");
			yield* verbs.refresh();
			yield* verbs.fail("refresh", "Offline");
		},
	);
}

export function feedbackRefreshing() {
	return feedbackAfter("the first read answered Last success, the content input holds Unsaved input and a refresh waits", function* (verbs) {
		yield* verbs.answer("first", "Last success");
		yield* verbs.type("local", "Unsaved input");
		yield* verbs.refresh();
	});
}
