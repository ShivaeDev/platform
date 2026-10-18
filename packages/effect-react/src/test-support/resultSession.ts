import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { act, createElement } from "react";
import { type ActionState, type QueryState, useAction, useQuery } from "#result-state.ts";
import { SessionBoundary } from "#session-boundary.ts";
import type { Rendered } from "#testing.ts";

interface Held<A, E> {
	current?: QueryState<A, E> | ActionState<void, A, E>;
}
function Query<A, E>({ atom, held }: { readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>; readonly held: Held<A, E> }) {
	held.current = useQuery(atom);
	return createElement("output", null, JSON.stringify(held.current));
}
function Action<A, E>({ atom, held }: { readonly atom: Atom.AtomResultFn<void, A, E>; readonly held: Held<A, E> }) {
	held.current = useAction(atom);
	return createElement(
		"button",
		{ onClick: () => held.current && "dispatch" in held.current && held.current.dispatch(), type: "button" },
		JSON.stringify(held.current),
	);
}
export async function resultSession<A, E>(view: Rendered, kind: "query" | "action", run: () => Effect.Effect<A, E>) {
	const query = Atom.make(Effect.suspend(run));
	const action = Atom.fn<void>()(run);
	const rechecks: string[] = [];
	const held: Held<A, E> = {};
	const boundary = {
		children: () => (kind === "query" ? createElement(Query<A, E>, { atom: query, held }) : createElement(Action<A, E>, { atom: action, held })),
		connect: () => undefined,
		identify: (session: string) => session,
		recheck: () => rechecks.push("session"),
		session: "session",
	};
	await view.render(createElement(SessionBoundary<string, undefined>, boundary));
	function current() {
		if (held.current === undefined) {
			throw new Error("Result hook did not render");
		}
		return held.current;
	}
	return {
		close: view.unmount,
		current,
		execute: () =>
			act(async () => {
				const state = current();
				if ("dispatch" in state) {
					view.container.querySelector("button")?.click();
				} else {
					state.refresh();
				}
				await Promise.resolve();
			}),
		rechecks,
		rerender: () => view.render(createElement(SessionBoundary<string, undefined>, boundary)),
	};
}
