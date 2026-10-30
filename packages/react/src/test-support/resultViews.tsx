import { Deferred, Effect, Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useState } from "react";
import { type ResultState, useAction, useQuery } from "#client/resultState.ts";
import { causeWords, dataWords, statusWords } from "./outcomeWords.ts";
import type { Dispatch, ResultEngine } from "./resultEngine.ts";

export function QueryValue<A>({ atom }: { readonly atom: Atom.Atom<AsyncResult.AsyncResult<A>> }) {
	return <output>{Option.match(useQuery(atom).data, { onNone: () => "loading", onSome: String })}</output>;
}
function Described({ state }: { readonly state: ResultState<unknown, string> }) {
	return (
		<dl>
			<dd data-status="">{statusWords(state)}</dd>
			<dd data-data="">{dataWords(state.data)}</dd>
			<dd data-cause="">{causeWords(state.cause)}</dd>
		</dl>
	);
}
function QueryResult({ atom }: { readonly atom: Atom.Atom<AsyncResult.AsyncResult<number, string>> }) {
	const state = useQuery(atom);
	return (
		<section>
			<button onClick={state.refresh} type="button">
				Run
			</button>
			<Described state={state} />
		</section>
	);
}
function ActionResult({ atom, input }: { readonly atom: Atom.AtomResultFn<number, number, string>; readonly input: number }) {
	const state = useAction(atom);
	return (
		<section>
			<button onClick={() => state.dispatch(input)} type="button">
				Run
			</button>
			<Described state={state} />
		</section>
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
				<QueryValue atom={atom} />
				<QueryValue atom={atom} />
			</div>
		);
	}
	if (mode === "query") {
		return <QueryResult atom={Atom.make(Effect.suspend(() => Deferred.await(engine.gate)))} />;
	}
	if (mode === "action") {
		return <ActionResult atom={Atom.fn<number>()((input) => Effect.map(Deferred.await(engine.gate), (value) => input + value))} input={5} />;
	}
	const overlapping = Atom.fn<number>()(() =>
		Effect.gen(function* () {
			const dispatch: Dispatch = { answer: yield* Deferred.make<number, string>(), outcome: "running" };
			engine.dispatches.push(dispatch);
			const answer = yield* Deferred.await(dispatch.answer).pipe(
				Effect.onInterrupt(() =>
					Effect.sync(() => {
						dispatch.outcome = "interrupted";
					}),
				),
			);
			dispatch.outcome = "answered";
			return answer;
		}),
	);
	return <ActionResult atom={overlapping} input={0} />;
}
