import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useLoaderQuery } from "@shivaedev/react/client/useLoaderQuery.ts";
import { useSignOut } from "@shivaedev/react/client/useSignOut.ts";
import type { AuthActions } from "#client/auth.ts";
import { Button } from "#client/ui/button.tsx";
import { Card, CardContent } from "#client/ui/card.tsx";
import type { Note } from "#modules/notes/notes.ts";
import { NoteCreate } from "./Create.tsx";
import type { NotesClient } from "./make.ts";
import { NotesTable } from "./Table.tsx";

export function NotesScreen({
	client,
	loaded,
	signOut,
}: {
	readonly client: NotesClient;
	readonly loaded: readonly (typeof Note.Type)[];
	readonly signOut?: AuthActions["signOut"];
}) {
	const query = useLoaderQuery(client.api.list.query(), loaded);
	const rows = query.data;
	return (
		<main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-12 sm:px-6">
			<header className="space-y-2">
				<p className="text-muted-foreground text-sm font-medium">Your first app</p>
				<h1 className="text-3xl font-semibold tracking-tight">Notes</h1>
				<p className="text-muted-foreground">A small place for things worth keeping.</p>
				<a className="inline-block text-sm underline" href="/admin/jobs">
					Administration
				</a>
				{signOut !== undefined && <SignOut action={signOut} />}
			</header>
			<section aria-label="Add a note">
				<Card>
					<CardContent>
						<NoteCreate client={client} />
					</CardContent>
				</Card>
			</section>
			<section aria-label="Saved notes" className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold">Saved notes</h2>
					<Button disabled={query.pending} onClick={query.refresh} variant="outline">
						Refresh
					</Button>
				</div>
				{Option.isSome(query.cause) && <p role="alert">Could not load notes. Try refreshing.</p>}
				{rows.length === 0 && <p className="text-muted-foreground text-sm">No notes yet. Add your first one above.</p>}
				{rows.length > 0 && <NotesTable notes={rows} />}
			</section>
		</main>
	);
}

function SignOut({ action }: { readonly action: AuthActions["signOut"] }) {
	const state = useSignOut(action, { signIn: "/sign-in" });
	const failure = AsyncResult.error(state.result);
	return (
		<>
			<Button disabled={state.pending} onClick={() => state.dispatch()} variant="outline">
				{state.pending ? "Signing out…" : "Sign out"}
			</Button>
			{!state.pending && Option.isSome(failure) && (
				<p role="alert">{"_tag" in failure.value ? "Could not sign out. Try again." : (failure.value.message ?? "Could not sign out. Try again.")}</p>
			)}
		</>
	);
}
