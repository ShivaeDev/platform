import { useAtomMount } from "@effect/atom-react";
import { Option } from "effect";
import { useState } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { Button } from "./Button.tsx";
import type { NotesClient } from "./makeNotes.ts";
import { NoteCreate } from "./NoteCreate.tsx";

function wordCountLabel(count: number | null) {
	if (count === null) {
		return "Counting words…";
	}
	return `${count} ${count === 1 ? "word" : "words"}`;
}

export function NotesScreen({ client, onSignOut }: { readonly client: NotesClient; readonly onSignOut?: () => Promise<string | undefined> }) {
	useAtomMount(client.connection);
	const [signingOut, setSigningOut] = useState(false);
	const [failure, setFailure] = useState<string>();
	async function signOut() {
		setSigningOut(true);
		try {
			setFailure(await onSignOut?.());
		} catch {
			setFailure("Could not sign out. Try again.");
		} finally {
			setSigningOut(false);
		}
	}
	const query = useQuery(client.api.list.query());
	const rows = Option.getOrElse(query.data, () => []);
	return (
		<main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-12 sm:px-6">
			<header className="space-y-2">
				<p className="font-medium text-muted-foreground text-sm">Your first app</p>
				<h1 className="font-semibold text-3xl tracking-tight">Notes</h1>
				<p className="text-muted-foreground">A small place for things worth keeping.</p>
				{onSignOut !== undefined && (
					<Button disabled={signingOut} onClick={() => void signOut()} variant="outline">
						Sign out
					</Button>
				)}
				{failure !== undefined && <p role="alert">{failure}</p>}
			</header>
			<section aria-label="Add a note" className="rounded-lg border bg-card p-5 shadow-sm">
				<NoteCreate client={client} />
			</section>
			<section aria-label="Saved notes" className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="font-semibold text-lg">Saved notes</h2>
					<Button disabled={query.pending} onClick={query.refresh} variant="outline">
						Refresh
					</Button>
				</div>
				{Option.isSome(query.cause) && <p role="alert">Could not load notes. Try refreshing.</p>}
				{query.pending ? <p role="status">Loading notes…</p> : null}
				{!query.pending && rows.length === 0 && <p className="text-muted-foreground text-sm">No notes yet. Add your first one above.</p>}
				<ul className="space-y-3">
					{rows.map((row) => (
						<li className="break-words rounded-lg border bg-card p-4" key={row.id}>
							<p>{row.title}</p>
							<p className="mt-2 text-muted-foreground text-sm">{wordCountLabel(row.wordCount)}</p>
						</li>
					))}
				</ul>
			</section>
		</main>
	);
}
