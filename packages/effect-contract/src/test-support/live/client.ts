import { Effect, Layer, Stream } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { bind } from "#bind.ts";
import { live } from "#live.ts";
import { type ResumeOptions, resumeSignal } from "#resume.ts";
import { Documents, LiveDocuments, workspace } from "./contract.ts";

export function liveClient(url: string, options: ResumeOptions = {}) {
	class Client extends AtomRpc.Service<Client>()("example/LiveDocuments", {
		group: LiveDocuments,
		protocol: RpcClient.layerProtocolHttp({ url: `${url}/rpc` }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
	}) {}
	const api = bind(Documents, Client);
	const resume = Atom.make(0);
	const signal = resumeSignal(options);
	const subscription = live(Client.runtime, {
		resume: Atom.make((get) => get(resume) + get(signal)),
		resyncKeys: [workspace.list],
		retryDelay: "100 millis",
		stream: Stream.unwrap(Client.use((client) => Effect.succeed(client("subscribe", undefined)))),
	});
	return { api, Client, resume, signal, ...subscription };
}
