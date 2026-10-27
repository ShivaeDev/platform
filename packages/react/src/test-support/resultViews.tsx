import { Deferred, Effect, Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useState } from "react";
import { useAction, useQuery } from "#client/resultState.ts";
import type { ResultEngine } from "./resultEngine.ts";

export function QueryValue({ atom }: { readonly atom: Atom.Atom<AsyncResult.AsyncResult<string>> }) {
	return <span>{Option.getOrElse(useQuery(atom).data, () => "loading")}</span>;
}
export function Shared({ atom }: { readonly atom: Atom.Atom<AsyncResult.AsyncResult<number>> }) {
	return <span>{Option.getOrNull(useQuery(atom).data)}</span>;
}
export function QueryResult({ atom }: { readonly atom: Atom.Atom<AsyncResult.AsyncResult<number, string>> }) {
	const state = useQuery(atom);
	return (
		<button onClick={state.refresh} type="button">
			{JSON.stringify({
				data: Option.getOrNull(state.data),
				failed: Option.isSome(state.cause),
				pending: state.pending,
				refreshing: state.refreshing,
			})}
		</button>
	);
}
export function ActionResult({
	atom,
	engine,
	overlap,
}: {
	readonly atom: Atom.AtomResultFn<number, number, string>;
	readonly engine: ResultEngine;
	readonly overlap: boolean;
}) {
	const state = useAction(atom);
	function handleClick() {
		state.dispatch(overlap ? engine.input : 5);
		engine.input += 1;
	}
	return (
		<button onClick={handleClick} type="button">
			{overlap
				? Option.getOrElse(state.data, () => -1)
				: JSON.stringify({ data: Option.getOrNull(state.data), failed: Option.isSome(state.cause), pending: state.pending })}
		</button>
	);
}
export function ResultView({ engine, mode }: { readonly engine: ResultEngine; readonly mode: "query" | "action" | "overlap" | "shared" }) {
	const [node] = useState(() => resultView(engine, mode));
	return node;
}
function resultView(engine: ResultEngine, mode: "query" | "action" | "overlap" | "shared") {
	if (mode === "shared") {
		const atom = Atom.make(
			Effect.sync(() => {
				engine.calls += 1;
				return engine.calls;
			}),
		);
		return (
			<div>
				<Shared atom={atom} />
				<Shared atom={atom} />
			</div>
		);
	}
	if (mode === "query") {
		return <QueryResult atom={Atom.make(Effect.suspend(() => Deferred.await(engine.gate)))} />;
	}
	const action = Atom.fn<number>()((input) => Effect.map(Deferred.await(engine.gate), (value) => input + value));
	const overlapping = Atom.fn<number>()((input) =>
		Deferred.await(input === 0 ? engine.first : engine.second).pipe(
			Effect.onInterrupt(() =>
				Effect.sync(() => {
					engine.interrupted = true;
				}),
			),
		),
	);
	return <ActionResult atom={mode === "action" ? action : overlapping} engine={engine} overlap={mode === "overlap"} />;
}
