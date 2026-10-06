import { Effect, Layer, Stream } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { live } from "@shivaedev/effect-contract/live.ts";
import { type ResumeOptions, resumeSignal } from "@shivaedev/effect-contract/resume.ts";
import { workContract, workRpcs } from "#rpc/contract.ts";
import { workspace } from "#rpc/keys.ts";

export interface Reader {
	readonly reader: unique symbol;
}

export function browserClient(url: string, options: ResumeOptions = {}) {
	class Client extends AtomRpc.Service<Reader>()("WorkBoard/Reader", {
		group: workRpcs,
		protocol: RpcClient.layerProtocolHttp({ url: `${url}/_board/rpc` }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
	}) {}
	const api = bind(workContract, Client);
	const registry = AtomRegistry.make({ "defaultIdleTTL": 0, timeoutResolution: 1 });
	const updates = live(Client.runtime, {
		resume: resumeSignal(options),
		resyncKeys: [workspace.list],
		stream: Stream.unwrap(Client.use((client) => Effect.succeed(client("work-board.subscribe", undefined)))),
	});
	registry.mount(updates.connection);
	async function read<A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>, signal?: AbortSignal) {
		try {
			return await Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }), { signal });
		} catch (error) {
			if (signal?.aborted) {
				const canceled = new Error("Reading canceled", { cause: error });
				canceled.name = "AbortError";
				throw canceled;
			}
			throw error;
		}
	}
	async function run<A, E>(effect: Effect.Effect<A, E, Reader>, signal?: AbortSignal) {
		try {
			return await Effect.runPromise(
				Effect.flatMap(AtomRegistry.getResult(registry, Client.runtime), (context) => Effect.provideContext(effect, context)),
				{ signal },
			);
		} catch (error) {
			if (signal?.aborted) {
				const canceled = new Error("Reading canceled", { cause: error });
				canceled.name = "AbortError";
				throw canceled;
			}
			throw error;
		}
	}
	return { api, read, registry, run, updates };
}
