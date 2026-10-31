import { useAtomValue } from "@effect/atom-react";
import { Cause, Effect, Option } from "effect";
import { Suspense, useState } from "react";
import { useAction, useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { NoticeHost } from "#notices.ts";
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
	const currentList = Option.getOrElse(list.data, () => "loading");
	const [feedback, present] = useState("");
	const action = useAction(
		client.runtime,
		(input: { readonly title: string }) => {
			const effect = client.run(input);
			return state.uninterruptible ? Effect.uninterruptible(effect) : effect;
		},
		{
			concurrent: state.concurrent,
			notices: {
				onFailure: (error, input) => ({ message: `${callback}: ${input.title} rejected: ${error._tag} / ${currentList}` }),
				onSuccess: (value, input) => ({ message: `${callback}: ${input.title} -> ${value} / ${currentList}` }),
			},
			onFailure: (error, input) => {
				notices.push(`${callback}: ${input.title} rejected: ${error._tag}`);
				present(`${callback}: ${input.title} rejected: ${error._tag} / ${currentList}`);
			},
			onSuccess: (value, input) => {
				if (defect) {
					throw new Error("Presentation failed");
				}
				notices.push(`${callback}: ${input.title} -> ${value}`);
				present(`${callback}: ${input.title} -> ${value} / ${currentList}`);
			},
		},
	);
	if (state.suspend !== undefined) {
		state.attempts.push(callback);
		throw state.suspend;
	}
	return (
		<>
			<button onClick={list.refresh} type="button">
				Refresh list
			</button>
			{["first", "second"].map((title) => (
				<button key={title} onClick={() => action.dispatch({ title })} type="button">
					{title}
				</button>
			))}
			<output data-pending={action.pending} data-query-pending={list.pending} data-result={action.result._tag}>
				{Option.getOrElse(action.data, () => "")}
			</output>
			<pre>{Option.match(action.cause, { onNone: () => "", onSome: Cause.pretty })}</pre>
			<p data-list="">{currentList}</p>
			<p data-callback="">{feedback}</p>
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
				{() => (
					<NoticeHost render={(notice) => <article>{notice.message}</article>}>
						<Commands state={state} />
					</NoticeHost>
				)}
			</SessionBoundary>
		</Suspense>
	);
}
