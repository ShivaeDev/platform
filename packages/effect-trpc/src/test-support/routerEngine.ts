import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";
import type { AnyTRPCRouter, TRPCDefaultErrorShape } from "@trpc/server";
import { Effect, type Layer, ManagedRuntime, type Scope } from "effect";
import type { EffectTRPCAdapter } from "#adapter.ts";
import type { EffectTRPCErrorContext } from "#types.ts";
import { inProcess } from "./http.ts";

export interface Host {
	readonly router: AnyTRPCRouter;
	readonly runWithServices: EffectTRPCAdapter<never>["runWithServices"];
	readonly starts?: ReadonlyMap<string, Promise<void>>;
}

export function scopedRuntime<R, E>(layer: Layer.Layer<R, E>) {
	return Effect.acquireRelease(
		Effect.sync(() => ManagedRuntime.make(layer)),
		(runtime) => Effect.promise(() => runtime.dispose()),
	);
}

export interface RouterEngine {
	build: { trait: string; run: (engine: RouterEngine) => Effect.Effect<Host, unknown, Scope.Scope> } | undefined;
	customErrorShape: boolean;
	finalized: string[];
	formatting: { original: TRPCDefaultErrorShape; formatted: TRPCDefaultErrorShape }[];
	host: ReturnType<typeof serve> | undefined;
	instrumented: { path: string; type: string }[];
	instrumentedRequests: string[];
	instrumentedStreams: { path: string; type: string }[];
	mapped: { error: unknown; origin: string; path: string }[];
	mode: { trait: string; value: "instrument-defect" | "mapper-defect" | "runtime-failure" } | undefined;
	requestId: string;
	streamStarted: ReturnType<typeof Promise.withResolvers<void>>;
}

export function emptyEngine(): RouterEngine {
	return {
		build: undefined,
		customErrorShape: false,
		finalized: [],
		formatting: [],
		host: undefined,
		instrumented: [],
		instrumentedRequests: [],
		instrumentedStreams: [],
		mapped: [],
		mode: undefined,
		requestId: "request-1",
		streamStarted: Promise.withResolvers<void>(),
	};
}

export function recordMapping(engine: RouterEngine, error: unknown, context: EffectTRPCErrorContext) {
	engine.mapped.push({ error, origin: context.origin, path: context.path });
}

export function serve(host: Host, engine: RouterEngine) {
	const http = inProcess(host.router, () => ({ requestId: engine.requestId }));
	const client = createTRPCUntypedClient({ links: [httpBatchLink(http)] });
	async function call<TValue = unknown>(path: string, input: unknown, signal?: AbortSignal): Promise<TValue> {
		const procedure = host.router.createCaller({ requestId: engine.requestId }, signal === undefined ? {} : { signal })[path];
		if (typeof procedure !== "function") {
			throw new Error(`No procedure at ${path}`);
		}
		return await procedure(input);
	}
	return { ...host, call, client, http, subscribe: call<AsyncIterable<unknown>> };
}

export function running(engine: RouterEngine) {
	if (engine.host === undefined) {
		throw new Error("The story has no running router");
	}
	return engine.host;
}
