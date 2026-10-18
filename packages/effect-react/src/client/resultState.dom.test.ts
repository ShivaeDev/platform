import { Cause, Deferred, Effect, Exit, Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { act, createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { isUnauthorized, useAction, useQuery } from "#result-state.ts";
import { resultSession } from "#test/resultSession.ts";
import { expectNoReactWarnings, render } from "#testing.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
it.each(["query", "action"] as const)("%s preserves a successful undefined as Some with settled flags", async (kind) => {
	const view = await resultSession(kind, () => Effect.succeed(undefined));
	try {
		if (kind === "action") {
			await view.execute();
		}
		expect(view.current().data).toEqual(Option.some(undefined));
		expect(view.current().pending).toBe(false);
		expect(view.current().refreshing).toBe(false);
		expect(view.current().cause).toEqual(Option.none());
	} finally {
		await view.close();
	}
});
it.each([
	["query", "defect"],
	["query", "interruption"],
	["action", "defect"],
	["action", "interruption"],
] as const)("%s exposes a %s cause without requesting a session recheck", async (kind, failure) => {
	const cause = failure === "defect" ? Cause.die({ _tag: "Unauthorized" }) : Cause.interrupt();
	const view = await resultSession(kind, () => Effect.failCause(cause));
	try {
		if (kind === "action") {
			await view.execute();
		}
		expect(view.current().cause).toEqual(Option.some(cause));
		expect(isUnauthorized(Option.getOrThrow(view.current().cause))).toBe(false);
		expect(view.rechecks).toEqual([]);
		await view.rerender();
		expect(view.rechecks).toEqual([]);
	} finally {
		await view.close();
	}
});
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) {
		await cleanup();
	}
});
async function mount(Component: () => React.ReactNode) {
	const { container, unmount } = await render(createElement(Component));
	cleanups.push(unmount);
	return container;
}
async function finish<A, E>(gate: Deferred.Deferred<A, E>, result: Exit.Exit<A, E>) {
	await act(() => {
		Effect.runSync(Deferred.done(gate, result));
	});
}
it("query renders retained data while refreshing and after a typed failure", async () => {
	let gate = Effect.runSync(Deferred.make<number, string>());
	const query = Atom.make(Effect.suspend(() => Deferred.await(gate)));
	const view = await mount(() => {
		const state = useQuery(query);
		return createElement(
			"button",
			{ onClick: state.refresh, type: "button" },
			JSON.stringify({
				data: Option.getOrNull(state.data),
				failed: Option.isSome(state.cause),
				pending: state.pending,
				refreshing: state.refreshing,
			}),
		);
	});
	function snapshot() {
		return JSON.parse(view.textContent ?? "");
	}
	expect(snapshot()).toEqual({
		data: null,
		failed: false,
		pending: true,
		refreshing: false,
	});
	await finish(gate, Exit.succeed(7));
	expect(snapshot()).toEqual({
		data: 7,
		failed: false,
		pending: false,
		refreshing: false,
	});
	gate = Effect.runSync(Deferred.make<number, string>());
	await act(async () => view.querySelector("button")?.click());
	expect(snapshot()).toEqual({
		data: 7,
		failed: false,
		pending: true,
		refreshing: true,
	});
	await finish(gate, Exit.fail("unavailable"));
	expect(snapshot()).toEqual({
		data: 7,
		failed: true,
		pending: false,
		refreshing: false,
	});
});
it("action renders ordinary success values and typed failures", async () => {
	let gate = Effect.runSync(Deferred.make<number, string>());
	const action = Atom.fn<number>()((input) => Effect.map(Deferred.await(gate), (value) => input + value));
	const view = await mount(() => {
		const state = useAction(action);
		return createElement(
			"button",
			{
				onClick: () => {
					state.dispatch(5);
				},
				type: "button",
			},
			JSON.stringify({
				data: Option.getOrNull(state.data),
				failed: Option.isSome(state.cause),
				pending: state.pending,
			}),
		);
	});
	await act(async () => view.querySelector("button")?.click());
	expect(JSON.parse(view.textContent ?? "")).toEqual({
		data: null,
		failed: false,
		pending: true,
	});
	await finish(gate, Exit.succeed(2));
	expect(JSON.parse(view.textContent ?? "")).toEqual({
		data: 7,
		failed: false,
		pending: false,
	});
	gate = Effect.runSync(Deferred.make<number, string>());
	await act(async () => view.querySelector("button")?.click());
	await finish(gate, Exit.fail("denied"));
	expect(JSON.parse(view.textContent ?? "")).toEqual({
		data: 7,
		failed: true,
		pending: false,
	});
});
it("changing query identity does not retain data from the previous query", async () => {
	const first = Atom.make(Effect.succeed("account A"));
	const next = Atom.make(Effect.never);

	const view = await render(createElement(QueryValue, { atom: first }));
	cleanups.push(view.unmount);
	const { container } = view;
	expect(container.textContent).toBe("account A");
	await view.render(createElement(QueryValue, { atom: next }));
	expect(container.textContent).toBe("loading");
});
it("consumers of the same query share the native execution", async () => {
	let calls = 0;
	const query = Atom.make(
		Effect.sync(() => {
			calls += 1;
			return calls;
		}),
	);

	const view = await mount(() => createElement("div", null, createElement(SharedQuery, { query }), createElement(SharedQuery, { query })));
	expect(view.textContent).toBe("11");
	expect(calls).toBe(1);
});
it("overlapping dispatches expose the latest native result", async () => {
	const first = Effect.runSync(Deferred.make<number>());
	const second = Effect.runSync(Deferred.make<number>());
	let interrupted = false;
	const action = Atom.fn<number>()((actionInput) =>
		Deferred.await(actionInput === 0 ? first : second).pipe(
			Effect.onInterrupt(() =>
				Effect.sync(() => {
					interrupted = true;
				}),
			),
		),
	);
	let input = 0;
	const view = await mount(() => {
		const state = useAction(action);
		return createElement(
			"button",
			{
				onClick: () => {
					state.dispatch(input);
					input += 1;
				},
				type: "button",
			},
			Option.getOrElse(state.data, () => -1),
		);
	});
	await act(async () => view.querySelector("button")?.click());
	await act(async () => view.querySelector("button")?.click());
	expect(interrupted).toBe(true);
	await finish(second, Exit.succeed(2));
	expect(view.textContent).toBe("2");
	await finish(first, Exit.succeed(1));
	expect(view.textContent).toBe("2");
});

function QueryValue({ atom }: { readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, never>> }) {
	const state = useQuery(atom);
	return createElement(
		"span",
		null,
		Option.getOrElse(state.data, () => "loading"),
	);
}
function SharedQuery({ query }: { readonly query: Atom.Atom<AsyncResult.AsyncResult<number, never>> }) {
	return createElement("span", null, Option.getOrNull(useQuery(query).data));
}
