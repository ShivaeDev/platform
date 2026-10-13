import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "#bind.ts";
import { live } from "#live.ts";
import { type ResumeOptions, resumeSignal } from "#resume.ts";
import { Documents, Subscribe } from "#test/live/contract.ts";

export function liveClient(url: string, options: ResumeOptions = {}, includeResume = true) {
	class Client extends AtomRpc.Service<Client>()("example/LiveDocuments", {
		group: Documents,
		protocol: RpcClient.layerProtocolHttp({ url: `${url}/rpc` }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
	}) {}
	const api = bind(Documents, Client);
	const resume = Atom.make(0);
	const signal = resumeSignal(options);
	const subscription = live(Client.runtime, {
		...(includeResume ? { resume: Atom.make((get) => get(resume) + get(signal)) } : {}),
		resyncKeys: Subscribe.reads(undefined),
		retryDelay: "100 millis",
		stream: api.subscribe.run(undefined),
	});
	return { api, Client, resume, signal, ...subscription };
}
