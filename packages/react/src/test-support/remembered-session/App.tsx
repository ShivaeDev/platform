import { Effect, Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { useState } from "react";
import type { RememberedSession } from "@shivaedev/identity/client/SessionMemory.ts";
import { useSignOut } from "#client/adapters/useSignOut.ts";
import type { RememberedAuthSession } from "#client/authSession.ts";
import { useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import type { RememberedClient } from "#test/remembered-session/client.ts";

function identify(session: RememberedSession) {
	return session.user.id;
}

function SignedOut({ client }: { readonly client: RememberedClient }) {
	const stored = Effect.runSync(Effect.orElseSucceed(client.stored, () => "unreadable"));
	return <h1>Signed out with {stored === null ? "nothing remembered" : "a remembered session"}</h1>;
}

function SignOutButton({ action }: { readonly action: Atom.AtomResultFn<void, void, never> }) {
	const signOut = useSignOut(action, { signIn: "/sign-in" });
	return (
		<button onClick={() => signOut.dispatch()} type="button">
			Sign out
		</button>
	);
}

export function RememberedApp({
	client,
	session,
	signOutVia = "session",
}: {
	readonly client: RememberedClient;
	readonly session: RememberedAuthSession<unknown>;
	readonly signOutVia?: "boundary" | "session" | undefined;
}) {
	const [signOut] = useState(() => Atom.fn<void>()(() => (signOutVia === "session" ? session.signOut(Effect.void) : client.signOutRequest)));
	const query = useQuery(session.atom);
	const current = Option.getOrNull(query.data);
	if (Option.isNone(query.data) && query.pending) {
		return <p role="status">Checking your session…</p>;
	}
	if (current === null && Option.isSome(query.cause)) {
		return <p role="alert">Could not check your session.</p>;
	}
	const grants = current?.user.permissions?.map((grant) => grant.name).join(", ") ?? "";
	return (
		<SessionBoundary
			connect={(connected, registry) => {
				const generation = { number: client.generations.length + 1, registry, user: identify(connected) };
				client.generations.push(generation);
				return generation;
			}}
			identify={identify}
			persist={client.memory}
			recheck={session.refresh}
			session={current ?? undefined}
			signedOut={<SignedOut client={client} />}
			signOut={signOut}
		>
			{(generation) => (
				<main aria-busy={query.refreshing}>
					<h1>
						{generation.user} in generation {generation.number}
					</h1>
					<p>Grants: {grants}</p>
					<SignOutButton action={signOut} />
				</main>
			)}
		</SessionBoundary>
	);
}
