import { useAtomValue } from "@effect/atom-react";
import { Cause, Effect, Option } from "effect";
import { Suspense } from "react";
import { useAction, useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import type { CompletionClient } from "./client.ts";

export interface CompletionScreen {
	readonly attempts: string[];
	readonly callback: string;
	readonly client: CompletionClient;
	readonly concurrent: boolean;
	readonly defect: boolean;
	readonly notices: string[];
	rechecks: number;
	readonly session: string;
	readonly suspend?: Promise<void>;
	readonly uninterruptible: boolean;
}
function Commands({ state }: { readonly state: CompletionScreen }) {
	const { client, callback, defect, notices } = state;
	useAtomValue(client.watcher);
	const list = useQuery(client.list);
	const action = useAction(
		client.runtime,
		(input: { readonly title: string }) => {
			const effect = client.run(input);
			return state.uninterruptible ? Effect.uninterruptible(effect) : effect;
		},
		{
			concurrent: state.concurrent,
			onFailure: (error, input) => {
				notices.push(`${callback}: ${input.title} rejected: ${error._tag}`);
			},
			onSuccess: (value, input) => {
				if (defect) {
					throw new Error("Presentation failed");
				}
				notices.push(`${callback}: ${input.title} -> ${value}`);
			},
		},
	);
	if (state.suspend !== undefined) {
		state.attempts.push(callback);
		throw state.suspend;
	}
	return (
		<>
			{["first", "second"].map((title) => (
				<button key={title} onClick={() => action.dispatch({ title })} type="button">
					{title}
				</button>
			))}
			<output data-pending={action.pending} data-query-pending={list.pending} data-result={action.result._tag}>
				{Option.getOrElse(action.data, () => "")}
			</output>
			<pre>{Option.match(action.cause, { onNone: () => "", onSome: Cause.pretty })}</pre>
		</>
	);
}
function identify(session: string) {
	return session;
}
export function CompletionView({ state }: { readonly state: CompletionScreen }) {
	return (
		<Suspense fallback="Loading">
			<SessionBoundary
				connect={() => state.client}
				identify={identify}
				recheck={() => {
					state.rechecks += 1;
				}}
				session={state.session}
			>
				{() => <Commands state={state} />}
			</SessionBoundary>
		</Suspense>
	);
}
