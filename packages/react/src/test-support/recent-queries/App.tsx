import { type Effect, type Layer, Option } from "effect";
import type { AtomRegistry } from "effect/reactivity/AtomRegistry";
import { useState } from "react";
import type { QueryStorageProvider } from "@shivaedev/contract/QueryStorage.ts";
import type { QueryRetentionOptions } from "@shivaedev/contract/queryRetention.ts";
import { useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { NoteRoute } from "#test/recent-queries/NoteRoute.tsx";
import type { openClient } from "#test/recent-queries/openClient.ts";

type Client = EffectClient["client"];
type EffectClient = Effect.Success<typeof openClient>;
export interface Controls {
	registry?: AtomRegistry;
	route?: (id: string) => void;
	session?: (user: string | undefined) => void;
	show?: (id: string | undefined) => void;
	warm?: (ids: readonly string[]) => void;
}
function Note({ client, id }: { readonly client: Client; readonly id: string }) {
	const query = useQuery(client.api.get.query({ id }));
	const title = Option.getOrElse(query.data, () => "Loading");
	const [first] = useState(title);
	return (
		<output data-first={first} data-id={id} data-pending={query.pending} data-stale={query.stale}>
			{title}
		</output>
	);
}
function Screen({ client, controls }: { readonly client: Client; readonly controls: Controls }) {
	const [id, show] = useState<string>();
	const [route, open] = useState<{ readonly id: string; readonly visit: number }>();
	controls.show = (next) => {
		open(undefined);
		show(next);
	};
	controls.route = (next) => {
		show(undefined);
		open((current) => ({ id: next, visit: (current?.visit ?? 0) + 1 }));
	};
	if (route !== undefined) {
		return <NoteRoute client={client} id={route.id} key={route.visit} />;
	}
	if (id === undefined) {
		return <p>Home</p>;
	}
	return <Note client={client} id={id} key={id} />;
}
export function App({
	client,
	controls,
	persist,
	retention,
	signedIn = "alice",
	warm,
}: {
	readonly client: Client;
	readonly controls: Controls;
	readonly persist?: Layer.Layer<QueryStorageProvider> | undefined;
	readonly retention: QueryRetentionOptions;
	readonly signedIn?: string | null;
	readonly warm: readonly string[];
}) {
	const [user, session] = useState<string | undefined>(signedIn ?? undefined);
	const [warmIds, setWarm] = useState(warm);
	controls.session = session;
	controls.warm = setWarm;
	return (
		<SessionBoundary
			connect={(_user, registry) => {
				controls.registry = registry;
				return client;
			}}
			identify={(id) => id}
			persist={persist}
			queryRetention={retention}
			recheck={() => undefined}
			session={user}
			signedOut={<p>Signed out</p>}
			warm={(connected) => warmIds.map((id) => connected.api.get.query({ id }))}
		>
			{(connected) => <Screen client={connected} controls={controls} />}
		</SessionBoundary>
	);
}
