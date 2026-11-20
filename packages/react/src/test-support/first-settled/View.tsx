import { Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useState } from "react";
import { useFirstSettled } from "#client/adapters/useFirstSettled.ts";
import { useAction, useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import type { FirstSettledClient } from "#test/first-settled/client.ts";

function Answer({ name, query }: { readonly name: string; readonly query: Atom.Atom<AsyncResult.AsyncResult<string, unknown>> }) {
	const answer = useQuery(query);
	return <output data-answer={name}>{Option.getOrElse(answer.data, () => "waiting")}</output>;
}

function Notes({ notes, reads }: { readonly notes: FirstSettledClient; readonly reads: boolean }) {
	const settled = useFirstSettled(notes.client);
	const rename = useAction(notes.rename);
	const [counting, setCounting] = useState(false);
	const { api } = notes.client;
	const first = reads ? (
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
	reads,
	session,
	warmCount,
}: {
	readonly connect: (session: string) => FirstSettledClient;
	readonly reads: boolean;
	readonly session: string;
	readonly warmCount: boolean;
}) {
	return (
		<SessionBoundary
			connect={connect}
			identify={(current) => current}
			recheck={() => undefined}
			session={session}
			warm={(notes) => (warmCount ? [notes.client.api.count.query()] : [])}
		>
			{(notes) => <Notes notes={notes} reads={reads} />}
		</SessionBoundary>
	);
}
