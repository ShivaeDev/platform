import { Effect, Option } from "effect";
import type { RememberedSession } from "@shivaedev/identity/client/SessionMemory.ts";
import type { AuthSession } from "#client/authSession.ts";
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

export function RememberedApp({
	client,
	session,
}: {
	readonly client: RememberedClient;
	readonly session: AuthSession<RememberedSession | null, unknown>;
}) {
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
			recheck={session.refresh}
			session={current ?? undefined}
			signedOut={<SignedOut client={client} />}
		>
			{(generation) => (
				<main aria-busy={query.refreshing}>
					<h1>
						{generation.user} in generation {generation.number}
					</h1>
					<p>Grants: {grants}</p>
				</main>
			)}
		</SessionBoundary>
	);
}
