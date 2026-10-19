import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { useState } from "react";
import { LiveConnection } from "@shivaedev/effect-contract/automaticLive.ts";
import { useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { connect } from "./connect.ts";

function Note({ client }: { readonly client: ReturnType<typeof connect> }) {
	const query = useQuery(client.get.query(undefined));
	const status = useAtomValue(client[LiveConnection].status);
	return (
		<output data-live={status.connection} data-pending={query.pending}>
			{Option.getOrUndefined(query.data) ?? "Loading"}
		</output>
	);
}

export function App({
	url,
	session,
	rechecked,
	signIn,
}: {
	readonly url: string;
	readonly session: () => string | undefined;
	readonly rechecked: () => void;
	readonly signIn: () => void;
}) {
	const [current, setSession] = useState(session);
	return (
		<SessionBoundary
			connect={() => connect(url)}
			identify={(id) => id}
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
