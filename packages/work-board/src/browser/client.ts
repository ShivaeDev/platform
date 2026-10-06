import { Effect, Layer, Stream } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import type * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import { type Bound, bind } from "@shivaedev/effect-contract/bind.ts";
import type { Contract } from "@shivaedev/effect-contract/contract.ts";
import { live } from "@shivaedev/effect-contract/live.ts";
import { type ResumeOptions, resumeSignal } from "@shivaedev/effect-contract/resume.ts";
import { type ReadFailed, workContract, workRpcs } from "#rpc/contract.ts";
import { workspace } from "#rpc/keys.ts";
import { responseContract } from "#rpc/responseContract.ts";

export interface Reader {
	readonly reader: unique symbol;
}

type BoundContract<TContract> =
	TContract extends Contract<infer TName, infer TQueries, infer TCommands, infer TRpcs> ? Bound<TName, TQueries, TCommands, TRpcs, Reader> : never;
export interface BrowserClient {
	readonly api: BoundContract<typeof workContract>;
	readonly mutate: <A, E>(effect: Effect.Effect<A, E, Reader | Reactivity.Reactivity>, signal?: AbortSignal) => Promise<A>;
	readonly read: <A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>, signal?: AbortSignal) => Promise<A>;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly responses: BoundContract<typeof responseContract>;
	readonly run: <A, E>(effect: Effect.Effect<A, E, Reader>, signal?: AbortSignal) => Promise<A>;
	readonly updates: ReturnType<typeof live<Reader, ReadFailed | RpcClientError, never>>;
}

export function browserClient(url: string, options: ResumeOptions = {}): BrowserClient {
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
	async function mutate<A, E>(effect: Effect.Effect<A, E, Reader | Reactivity.Reactivity>, signal?: AbortSignal) {
		const result = await Effect.runPromise(Effect.result(AtomRegistry.getResult(registry, Client.runtime.atom(effect), { suspendOnWaiting: true })), {
			signal,
		});
		if (result._tag === "Failure") {
			throw result.failure;
		}
		return result.success;
	}
	const responses = bind(responseContract, Client);
	return { api, mutate, read, registry, responses, run, updates };
}
