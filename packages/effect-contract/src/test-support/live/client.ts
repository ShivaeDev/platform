import { Effect, Layer, Stream, SubscriptionRef } from "effect";
import { FetchHttpClient } from "effect/http";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "#bind.ts";
import { type LiveHint, live } from "#live.ts";
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
	const received = Effect.runSync(SubscriptionRef.make<Record<LiveHint["_tag"], number>>({ Changed: 0, Resync: 0 }));
	const subscription = live(Client.runtime, {
		...(includeResume ? { resume: Atom.make((get) => get(resume) + get(signal)) } : {}),
		resyncKeys: Subscribe.reads(undefined),
		retryDelay: "100 millis",
		stream: api.subscribe
			.run(undefined)
			.pipe(Stream.tap((hint) => SubscriptionRef.update(received, (counts) => ({ ...counts, [hint._tag]: counts[hint._tag] + 1 })))),
	});
	return { api, Client, received, resume, signal, ...subscription };
}
