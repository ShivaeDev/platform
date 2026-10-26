import { RegistryContext } from "@effect/atom-react";
import { Cause, Deferred, Effect, type Exit, Layer, Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";
import { act, createElement } from "react";
import { type QueryOptions, useQuery } from "#client/resultState.ts";
import type { Rendered } from "#client/testing.ts";
import { QueryFeedbackScreen } from "./QueryFeedbackScreen.tsx";
import { clickButton, typeInput } from "./Screen.ts";

export interface Unavailable {
	readonly _tag: "Unavailable";
	readonly message: string;
}

type Query = Atom.Atom<AsyncResult.AsyncResult<string, Unavailable>>;
export function queryGate() {
	return Effect.runSync(Deferred.make<string, Unavailable>());
}

export async function finishQuery(gate: Deferred.Deferred<string, Unavailable>, result: Exit.Exit<string, Unavailable>) {
	await act(async () => {
		await Effect.runPromise(Deferred.done(gate, result));
	});
}

export function queryRequests() {
	let gate = queryGate();
	const interrupted: string[] = [];
	const queries = Atom.family((payload: string) =>
		Atom.make(Effect.suspend(() => Deferred.await(gate)).pipe(Effect.onInterrupt(() => Effect.sync(() => interrupted.push(payload))))).pipe(
			Atom.setIdleTTL(0),
			Atom.withReactivity(["reports"]),
		),
	);
	const runtime = Atom.runtime(Layer.empty);
	const invalidation = runtime.fn<void>()(() => Reactivity.invalidate(["reports"]));
	return {
		gate: () => gate,
		interrupted,
		invalidation,
		next: () => {
			gate = queryGate();
			return gate;
		},
		queries,
	};
}

function QueryProbe({ atom, options }: { readonly atom: Query; readonly options: QueryOptions }) {
	const query = useQuery(atom, options);
	return createElement(
		"button",
		{ onClick: query.refresh, type: "button" },
		JSON.stringify({
			data: Option.getOrNull(query.data),
			failure: Option.getOrNull(Option.flatMap(query.cause, Cause.findErrorOption)),
			pending: query.pending,
			refreshing: query.refreshing,
		}),
	);
}

export async function queryView(view: Rendered, atom: Query, options: QueryOptions = {}, feedback = false) {
	const { registry, container } = view;
	async function render(next: Query, nextOptions = options, owner = registry) {
		await view.render(
			createElement(
				RegistryContext.Provider,
				{ value: owner },
				createElement(feedback ? QueryFeedbackScreen : QueryProbe, { atom: next, options: nextOptions }),
			),
		);
	}
	await render(atom);
	return {
		click: (label: string) => clickButton(container, label),
		container,
		invalidate: async (invalidation: Atom.AtomResultFn<void, void>) => {
			await act(async () => registry.set(invalidation, undefined));
		},
		refresh: async () => {
			await act(() => {
				const button = container.querySelector("button");
				if (!button) {
					throw new Error("Missing query refresh button");
				}
				button.click();
			});
		},
		registry,
		render,
		snapshot: () => JSON.parse(container.textContent ?? ""),
		type: (name: string, value: string) => typeInput(container, name, value),
		unmount: view.unmount,
	};
}
