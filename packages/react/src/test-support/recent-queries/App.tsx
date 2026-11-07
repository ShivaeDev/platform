import { type Effect, Option } from "effect";
import type { AtomRegistry } from "effect/reactivity/AtomRegistry";
import { useState } from "react";
import type { QueryRetentionOptions } from "@shivaedev/contract/queryRetention.ts";
import { useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import type { openClient } from "#test/recent-queries/openClient.ts";

type Client = EffectClient["client"];
type EffectClient = Effect.Success<typeof openClient>;
export interface Controls {
	registry?: AtomRegistry;
	session?: (user: string | undefined) => void;
	show?: (id: string | undefined) => void;
}
function Note({ client, id }: { readonly client: Client; readonly id: string }) {
	const query = useQuery(client.api.get.query({ id }));
	return (
		<output data-pending={query.pending} data-stale={query.stale}>
			{Option.getOrElse(query.data, () => "Loading")}
		</output>
	);
}
function Screen({ client, controls }: { readonly client: Client; readonly controls: Controls }) {
	const [id, show] = useState<string>();
	controls.show = show;
	return id === undefined ? <p>Home</p> : <Note client={client} id={id} />;
}
export function App({
	client,
	controls,
	retention,
}: {
	readonly client: Client;
	readonly controls: Controls;
	readonly retention: QueryRetentionOptions;
}) {
	const [user, session] = useState<string | undefined>("alice");
	controls.session = session;
	return (
		<SessionBoundary
			connect={(_user, registry) => {
				controls.registry = registry;
				return client;
			}}
			identify={(id) => id}
			queryRetention={retention}
			recheck={() => undefined}
			session={user}
			signedOut={<p>Signed out</p>}
		>
			{(connected) => <Screen client={connected} controls={controls} />}
		</SessionBoundary>
	);
}
