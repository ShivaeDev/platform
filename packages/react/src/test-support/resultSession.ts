import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { act, createElement } from "react";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { type ActionState, type QueryState, useAction, useQuery } from "#client/resultState.ts";
import { UnstableSession } from "./UnstableSession.tsx";

interface Held<A, E> {
	current?: QueryState<A, E> | ActionState<void, A, E>;
}
function Query<A, E>({ atom, held }: { readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>; readonly held: Held<A, E> }) {
	held.current = useQuery(atom);
	return null;
}
function Action<A, E>({ atom, held }: { readonly atom: Atom.AtomResultFn<void, A, E>; readonly held: Held<A, E> }) {
	held.current = useAction(atom);
	return null;
}
export async function resultSession<A, E>(view: Rendered, kind: "query" | "action", run: () => Effect.Effect<A, E>) {
	const query = Atom.make(Effect.suspend(run));
	const action = Atom.fn<void>()(run);
	const rechecks: string[] = [];
	const held: Held<A, E> = {};
	function render() {
		return view.render(
			createElement(
				UnstableSession,
				{
					onRecheck: (generation) => {
						rechecks.push(`session-${generation}`);
					},
				},
				kind === "query" ? createElement(Query<A, E>, { atom: query, held }) : createElement(Action<A, E>, { atom: action, held }),
			),
		);
	}
	await render();
	function current() {
		if (held.current === undefined) {
			throw new Error("The result hook did not render");
		}
		return held.current;
	}
	return {
		current,
		execute: () =>
			act(async () => {
				const state = current();
				if ("dispatch" in state) {
					state.dispatch();
				} else {
					state.refresh();
				}
				await Promise.resolve();
			}),
		rechecks,
		rerender: render,
	};
}
