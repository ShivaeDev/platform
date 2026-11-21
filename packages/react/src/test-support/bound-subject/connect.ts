import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { Journal } from "#test/bound-subject/Journal.ts";

export function connect(url: string, runtime: Atom.RuntimeFactory) {
	const client = makeClient(
		{ journal: Journal },
		{ bearerToken: Effect.succeed("coach"), runtime, url, webSocketConstructor: layerWebSocketConstructor },
	);
	return { activity: clientActivity(client), api: client.api };
}

export type JournalClient = ReturnType<typeof connect>;
