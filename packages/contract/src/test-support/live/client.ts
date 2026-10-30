import { type Duration, Effect, Layer, Stream, SubscriptionRef } from "effect";
import { FetchHttpClient } from "effect/http";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import type { Key } from "@shivaedev/changes/keys.ts";
import { bind } from "#bind.ts";
import { type LiveHint, live } from "#live.ts";
import { type ResumeOptions, resumeSignal } from "#resume.ts";
import { notes } from "#test/notes.ts";
import { LiveNotes } from "./notesContract.ts";

export interface LiveClientSettings {
	readonly coalesceWindow?: Duration.Input;
	readonly includeResume?: boolean;
	readonly resyncKeys?: readonly Key[];
}

export type HandledHints = Readonly<Record<LiveHint["_tag"], number> & { readonly at: number }>;

export function liveClient(url: string, options: ResumeOptions = {}, settings: LiveClientSettings = {}) {
	const { coalesceWindow, includeResume = true, resyncKeys = [notes.item(1), notes.item(2), notes.list] } = settings;
	class Client extends AtomRpc.Service<Client>()("example/LiveDocuments", {
		group: LiveNotes,
		protocol: RpcClient.layerProtocolHttp({ url: `${url}/rpc` }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
	}) {}
	const api = bind(LiveNotes, Client, { live: false });
	const resume = Atom.make(0);
	const signal = resumeSignal(options);
	const handled = Effect.runSync(SubscriptionRef.make<HandledHints>({ at: 0, Changed: 0, Resync: 0 }));
	// The count moves when live() pulls the element after a hint, so a waiter sees the hint already handled.
	function counted(hint: LiveHint) {
		return Stream.concat(
			Stream.succeed(hint),
			Stream.drain(
				Stream.fromEffect(SubscriptionRef.update(handled, (counts) => ({ ...counts, at: performance.now(), [hint._tag]: counts[hint._tag] + 1 }))),
			),
		);
	}
	const subscription = live(Client.runtime, {
		...(coalesceWindow === undefined ? {} : { coalesceWindow }),
		...(includeResume ? { resume: Atom.make((get) => get(resume) + get(signal)) } : {}),
		resyncKeys,
		retryDelay: "100 millis",
		stream: api.subscribe.run(undefined).pipe(Stream.flatMap(counted)),
	});
	return { api, Client, handled, resume, signal, ...subscription };
}
