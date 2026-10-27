import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { Notes } from "#modules/notes/notes.ts";

export function makeNotesClient(url: string, transformClient?: NonNullable<Parameters<typeof RpcClient.layerProtocolHttp>[0]["transformClient"]>) {
	class NotesClient extends AtomRpc.Service<NotesClient>()("app/NotesClient", {
		group: Notes,
		protocol: RpcClient.layerProtocolHttp({ ...(transformClient === undefined ? {} : { transformClient }), url }).pipe(
			Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
		),
	}) {}
	const api = bind(Notes, NotesClient);
	return { api, runtime: NotesClient.runtime };
}

export type NotesClient = ReturnType<typeof makeNotesClient>;
