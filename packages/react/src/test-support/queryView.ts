import { RegistryContext } from "@effect/atom-react";
import { Cause, Deferred, Effect, Layer, Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";
import { act, createElement } from "react";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { type QueryOptions, useQuery } from "#client/resultState.ts";
import { statusWords } from "./outcomeWords.ts";
import { QueryFeedbackScreen } from "./QueryFeedbackScreen.tsx";

export interface Unavailable {
	readonly _tag: "Unavailable";
	readonly message: string;
}

export type Query = Atom.Atom<AsyncResult.AsyncResult<string, Unavailable>>;

export interface Shown {
	readonly data: string;
	readonly failure: string;
	readonly status: string;
}

export function heldReads() {
	const held = new Map<string, Deferred.Deferred<string, Unavailable>>();
	let gate = Deferred.makeUnsafe<string, Unavailable>();
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
		held: (label: string) => {
			const found = held.get(label);
			if (found === undefined) {
				throw new Error(`No read named ${label} was started`);
			}
			return found;
		},
		interrupted,
		invalidation,
		next: (label: string) => {
			gate = Deferred.makeUnsafe<string, Unavailable>();
			held.set(label, gate);
		},
		queries,
	};
}

function QueryProbe({ atom, options }: { readonly atom: Query; readonly options: QueryOptions }) {
	const query = useQuery(atom, options);
	const failure = Option.getOrNull(Option.flatMap(query.cause, Cause.findErrorOption));
	const shown: Shown = {
		data: Option.getOrElse(query.data, () => "none"),
		failure: failure === null ? "none" : `${failure._tag}: ${failure.message}`,
		status: statusWords(query),
	};
	return createElement("button", { onClick: query.refresh, type: "button" }, JSON.stringify(shown));
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
		container,
		invalidate: async (invalidation: Atom.AtomResultFn<void, void>) => {
			await act(async () => registry.set(invalidation, undefined));
		},
		registry,
		render,
		shown: (): Shown => JSON.parse(container.querySelector("button")?.textContent ?? ""),
		unmount: view.unmount,
	};
}
