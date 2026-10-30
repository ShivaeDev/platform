import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { type LiveBound, LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { type Bound, bind, makeClient } from "@shivaedev/contract/bind.ts";
import type { Contract } from "@shivaedev/contract/contract.ts";
import type { ResumeOptions } from "@shivaedev/contract/resume.ts";
import { workContract, workRpcs } from "#rpc/contract.ts";
import { handoffContract } from "#rpc/handoffContract.ts";
import type { Indexing } from "#rpc/Indexing.ts";
import { responseContract } from "#rpc/responseContract.ts";

function connection(url: string) {
	return makeClient(workContract, { group: workRpcs, url: `${url.replace(/\/$/u, "")}/_board/rpc` });
}
export type Reader = ReturnType<typeof connection>["Client"]["Identifier"];

type BoundContract<TContract> =
	TContract extends Contract<infer TName, infer TQueries, infer TCommands, infer TRpcs, infer TStreams>
		? Bound<TName, TQueries, TCommands, TRpcs, Reader, TStreams>
		: never;
export interface BrowserClient {
	readonly api: BoundContract<typeof workContract>;
	readonly handoffs: BoundContract<typeof handoffContract>;
	readonly indexing: Atom.Atom<Indexing | undefined>;
	readonly mutate: <A, E>(effect: Effect.Effect<A, E, Reader | Reactivity.Reactivity>, signal?: AbortSignal) => Promise<A>;
	readonly read: <A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>, signal?: AbortSignal) => Promise<A>;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly responses: BoundContract<typeof responseContract>;
	readonly run: <A, E>(effect: Effect.Effect<A, E, Reader>, signal?: AbortSignal) => Promise<A>;
	readonly runtime: Atom.AtomRuntime<Reader>;
	readonly updates: LiveBound[typeof LiveConnection];
}

export function browserClient(url: string, options: ResumeOptions = {}): BrowserClient {
	const { Client } = connection(url);
	const bindOptions = {
		...(options.native === undefined ? {} : { resume: options.native }),
		...(options.window === undefined ? {} : { resumeWindow: options.window }),
	};
	const api = bind(workContract, Client, bindOptions);
	const registry = AtomRegistry.make({ "defaultIdleTTL": 0, timeoutResolution: 1 });
	const indexing = Atom.map(api.indexing.query(), (result) => (AsyncResult.isSuccess(result) ? result.value : undefined));
	const updates = api[LiveConnection];
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
	const responses = bind(responseContract, Client, bindOptions);
	return {
		api,
		handoffs: bind(handoffContract, Client, bindOptions),
		indexing,
		mutate,
		read,
		registry,
		responses,
		run,
		runtime: Client.runtime,
		updates,
	};
}
