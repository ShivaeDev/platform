import { type Layer, Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useEffect, useState } from "react";
import type { QueryStorageProvider } from "@shivaedev/contract/QueryStorage.ts";
import { useFirstSettled } from "#client/adapters/useFirstSettled.ts";
import { useAction, useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import type { FirstSettledClient } from "#test/first-settled/client.ts";
import { type FirstRoute, type Provider, RoutedNotes } from "#test/first-settled/routed.tsx";

function Answer({ name, query }: { readonly name: string; readonly query: Atom.Atom<AsyncResult.AsyncResult<string, unknown>> }) {
	const answer = useQuery(query);
	return (
		<output data-answer={name} data-refreshing={answer.refreshing} data-stale={answer.stale}>
			{Option.getOrElse(answer.data, () => "waiting")}
		</output>
	);
}

export type FirstReads = "title and author" | "no query" | "count after its first render";

function Notes({ notes, reads }: { readonly notes: FirstSettledClient; readonly reads: FirstReads }) {
	const settled = useFirstSettled(notes.client);
	const rename = useAction(notes.rename);
	const [counting, setCounting] = useState(false);
	useEffect(() => {
		if (reads === "count after its first render") {
			setCounting(true);
		}
	}, [reads]);
	const { api } = notes.client;
	const first =
		reads === "title and author" ? (
			<>
				<Answer name="title" query={api.title.query()} />
				<Answer name="author" query={api.author.query()} />
			</>
		) : null;
	const count = counting ? <Answer name="count" query={api.count.query()} /> : null;
	return (
		<article>
			<p role="status">{settled ? "first results settled" : "waiting for first results"}</p>
			{first}
			{count}
			<button onClick={() => rename.dispatch()} type="button">
				Rename
			</button>
			<output data-command={rename.result._tag} />
			<button onClick={() => setCounting(true)} type="button">
				Show count
			</button>
		</article>
	);
}

export function View({
	connect,
	persist,
	reads,
	routed,
	session,
	warmCount,
}: {
	readonly connect: (session: string) => FirstSettledClient;
	readonly persist: Layer.Layer<QueryStorageProvider> | undefined;
	readonly reads: FirstReads;
	readonly routed: { readonly provider: Provider; readonly route: FirstRoute } | undefined;
	readonly session: string;
	readonly warmCount: boolean;
}) {
	return (
		<SessionBoundary
			connect={connect}
			identify={(current) => current}
			persist={persist}
			recheck={() => undefined}
			session={session}
			warm={(notes) => (warmCount ? [notes.client.api.count.query()] : [])}
		>
			{(notes) => (routed === undefined ? <Notes notes={notes} reads={reads} /> : <RoutedNotes notes={notes} {...routed} />)}
		</SessionBoundary>
	);
}
