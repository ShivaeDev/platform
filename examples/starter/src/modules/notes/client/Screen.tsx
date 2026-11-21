import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import { useSignOut } from "@shivaedev/react/client/adapters/useSignOut.ts";
import type { LoadedQueryState } from "@shivaedev/react/client/useLoaderQuery.ts";
import type { AuthActions } from "#client/adapters/auth.ts";
import { Button } from "#client/ui/button.tsx";
import { Card, CardContent } from "#client/ui/card.tsx";
import type { Notes } from "#generated/modules/notes/Notes.ts";
import { NoteCreate } from "#modules/notes/client/Create.tsx";
import { NotesTable } from "#modules/notes/client/Table.tsx";
import type { Note } from "#modules/notes/model.ts";

export function NotesScreen({
	client,
	query,
	signOut,
}: {
	readonly client: ContractClient<typeof Notes>;
	readonly query: LoadedQueryState<(typeof Note.Type)[], unknown>;
	readonly signOut?: AuthActions["signOut"];
}) {
	const rows = query.data;
	const signOutControl = signOut !== undefined && <SignOut action={signOut} />;
	const emptyMessage = rows.length === 0 && <p className="text-muted-foreground text-sm">No notes yet. Add your first one above.</p>;
	const table = rows.length > 0 && <NotesTable notes={rows} />;
	return (
		<main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-12 sm:px-6">
			<header className="space-y-2">
				<p className="text-muted-foreground text-sm font-medium">Your first app</p>
				<h1 className="text-3xl font-semibold tracking-tight">Notes</h1>
				<p className="text-muted-foreground">A small place for things worth keeping.</p>
				<a className="inline-block text-sm underline" href="/admin/jobs">
					Administration
				</a>
				{signOutControl}
			</header>
			<section aria-label="Add a note">
				<Card>
					<CardContent>
						<NoteCreate client={client} />
					</CardContent>
				</Card>
			</section>
			<section aria-busy={query.pending} aria-label="Saved notes" className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold">Saved notes</h2>
					<Button disabled={query.pending} onClick={query.refresh} variant="outline">
						Refresh
					</Button>
				</div>
				{emptyMessage}
				{table}
			</section>
		</main>
	);
}

function SignOut({ action }: { readonly action: AuthActions["signOut"] }) {
	const state = useSignOut(action, { signIn: "/sign-in" });
	const failure = AsyncResult.error(state.result);
	const signOutFailure = !state.pending && Option.isSome(failure) && <p role="alert">Could not sign out. Try again.</p>;
	return (
		<>
			<Button disabled={state.pending} onClick={() => state.dispatch()} variant="outline">
				{state.pending ? "Signing out…" : "Sign out"}
			</Button>
			{signOutFailure}
		</>
	);
}
