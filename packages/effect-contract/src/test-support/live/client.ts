import { Effect, Layer, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "#bind.ts";
import { live } from "#live.ts";
import { type ResumeOptions, resumeSignal } from "#resume.ts";
import { LiveNotes, Subscribe } from "./notesContract.ts";

export function liveClient(url: string, options: ResumeOptions = {}, includeResume = true) {
	class Client extends AtomRpc.Service<Client>()("example/LiveDocuments", {
		group: LiveNotes,
		protocol: RpcClient.layerProtocolHttp({ url: `${url}/rpc` }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
	}) {}
	const api = bind(LiveNotes, Client);
	const resume = Atom.make(0);
	const signal = resumeSignal(options);
	let receivedHints = 0;
	const subscription = live(Client.runtime, {
		...(includeResume ? { resume: Atom.make((get) => get(resume) + get(signal)) } : {}),
		resyncKeys: Subscribe.reads(undefined),
		retryDelay: "100 millis",
		stream: api.subscribe.run(undefined).pipe(
			Stream.tap(() =>
				Effect.sync(() => {
					receivedHints += 1;
				}),
			),
		),
	});
	return { api, Client, receivedHints: () => receivedHints, resume, signal, ...subscription };
}
