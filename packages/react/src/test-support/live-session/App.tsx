import { useAtomValue } from "@effect/atom-react";
import { Cause, Option, Predicate } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useState } from "react";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { connect } from "./connect.ts";

export function Note({ client }: { readonly client: ReturnType<typeof connect> }) {
	const query = useQuery(client.get.query(undefined));
	const status = useAtomValue(client[LiveConnection].status);
	const denied = Option.exists(query.cause, (cause) =>
		Option.exists(Cause.findErrorOption(cause), (error) => Predicate.isTagged(error, "QueryReadDenied")),
	);
	const content = denied ? "Read denied" : (Option.getOrUndefined(query.data) ?? "Loading");
	return (
		<output data-denied={denied} data-live={status.connection} data-pending={query.pending}>
			{content}
		</output>
	);
}

export function App({
	url,
	session,
	rechecked,
	signIn,
	connected,
}: {
	readonly connected: (registry: AtomRegistry.AtomRegistry, client: ReturnType<typeof connect>) => void;
	readonly url: string;
	readonly session: () => string | undefined;
	readonly rechecked: () => void;
	readonly signIn: () => void;
}) {
	const [current, setSession] = useState(session);
	return (
		<SessionBoundary
			connect={(_, registry) => {
				const client = connect(url, registry);
				connected(registry, client);
				return client;
			}}
			identify={(id) => id}
			liveCoalesceWindow="500 millis"
			recheck={() => {
				rechecked();
				setSession(session());
			}}
			session={current}
			signedOut={
				<button
					onClick={() => {
						signIn();
						setSession(session());
					}}
					type="button"
				>
					Sign in
				</button>
			}
		>
			{(client) => <Note client={client} />}
		</SessionBoundary>
	);
}
