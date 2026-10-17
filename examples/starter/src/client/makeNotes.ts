import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { live } from "@shivaedev/effect-contract/live.ts";
import { resumeSignal } from "@shivaedev/effect-contract/resume.ts";
import { Notes, Subscribe } from "#notes.ts";

export function makeNotesClient(url: string, transformClient?: NonNullable<Parameters<typeof RpcClient.layerProtocolHttp>[0]["transformClient"]>) {
	class NotesClient extends AtomRpc.Service<NotesClient>()("app/NotesClient", {
		group: Notes,
		protocol: RpcClient.layerProtocolHttp({ ...(transformClient === undefined ? {} : { transformClient }), url }).pipe(
			Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
		),
	}) {}
	const api = bind(Notes, NotesClient);
	const subscription = live(NotesClient.runtime, {
		resume: resumeSignal(typeof window === "undefined" ? {} : { window }),
		resyncKeys: Subscribe.reads(undefined),
		stream: api.subscribe.run(undefined),
	});
	return { api, runtime: NotesClient.runtime, ...subscription };
}

export type NotesClient = ReturnType<typeof makeNotesClient>;
