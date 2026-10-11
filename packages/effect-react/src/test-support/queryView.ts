import { RegistryContext } from "@effect/atom-react";
import { Cause, Deferred, Effect, type Exit, Layer, Option } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { act, createElement } from "react";
import { onTestFinished } from "vitest";
import { type QueryOptions, useQuery } from "#result-state.ts";
import { render as renderView } from "#testing.ts";

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
			Atom.setIdleTTL(0),
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

export async function queryView(atom: Query, options: QueryOptions = {}) {
	const view = await renderView(null);
	const { registry, container } = view;
	onTestFinished(view.unmount);
	async function render(next: Query, nextOptions = options, owner = registry) {
		await view.render(createElement(RegistryContext.Provider, { value: owner }, createElement(QueryProbe, { atom: next, options: nextOptions })));
	}
	await render(atom);
	return {
		invalidate: async (invalidation: Atom.AtomResultFn<void, void>) => {
			await act(async () => registry.set(invalidation, undefined));
		},
		refresh: async () => {
			await act(async () => container.querySelector("button")?.click());
		},
		registry,
		render,
		snapshot: () => JSON.parse(container.textContent ?? ""),
	};
}
