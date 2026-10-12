import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { Notes } from "#notes.ts";

export function makeNotesClient(url: string) {
	class NotesClient extends AtomRpc.Service<NotesClient>()("starter/NotesClient", {
		group: Notes,
		protocol: RpcClient.layerProtocolHttp({ url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
	}) {}
	return { api: bind(Notes, NotesClient), runtime: NotesClient.runtime };
}

export type NotesClient = ReturnType<typeof makeNotesClient>;
