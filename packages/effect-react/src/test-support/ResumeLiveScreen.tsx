import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { LiveConnection } from "@shivaedev/effect-contract/automaticLive.ts";
import { useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import type { resumeLiveClient } from "./resumeLiveClient.ts";

type Client = ReturnType<typeof resumeLiveClient>;

function LiveValues({ client }: { readonly client: Client }) {
	const one = useQuery(client.api.get.query({ id: 1 }));
	const two = useQuery(client.api.get.query({ id: 2 }));
	const status = useAtomValue(client.api[LiveConnection].status);
	return (
		<output data-live={status.connection}>
			{Option.getOrUndefined(one.data)} / {Option.getOrUndefined(two.data)}
		</output>
	);
}

export function ResumeLiveScreen({ client }: { readonly client: Client }) {
	return (
		<SessionBoundary connect={() => client} identify={(session) => session} recheck={() => undefined} session="ada">
			{(current) => <LiveValues client={current} />}
		</SessionBoundary>
	);
}
