import { initTRPC, TRPCError } from "@trpc/server";
import { Effect, Layer, Option } from "effect";
import superjson from "superjson";
import { makeEffectTRPC } from "#adapter.ts";
import { rejectionFormatter, withRejection } from "#rejection-formatter.ts";
import { makeRequestServices } from "#request-services.ts";
import { DomainFailure, RequestValue } from "./adapterServices.ts";
import { type RouterEngine, recordMapping, scopedRuntime } from "./routerEngine.ts";

export function* adapterHost<R, E>(engine: RouterEngine, layer: Layer.Layer<R, E>) {
	const runtime = yield* scopedRuntime(layer);
	const adapter = makeEffectTRPC({
		instrument: (effect, info) => {
			if (engine.mode === "instrument-defect") {
				throw new Error("private instrumentation detail");
			}
			return Effect.gen(function* () {
				engine.instrumented.push({ path: info.path, type: info.type });
				const request = yield* Effect.serviceOption(RequestValue);
				if (Option.isSome(request)) {
					engine.instrumentedRequests.push(request.value);
				}
				return yield* effect;
			});
		},
		instrumentStream: (stream, info) => {
			engine.instrumentedStreams.push({ path: info.path, type: info.type });
			return stream;
		},
		mapError: (error, context) => {
			recordMapping(engine, error, context);
			if (engine.mode === "mapper-defect") {
				throw new Error("private mapper detail");
			}
			if (error instanceof DomainFailure) {
				return new TRPCError({ code: "CONFLICT", message: error.message });
			}
			return error === "subscription unavailable"
				? new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Updates temporarily unavailable" })
				: undefined;
		},
		runtime,
	});
	const t = serverTrpc(engine);
	const procedure = adapter.procedure(
		t.procedure,
		makeRequestServices(() => Layer.empty),
	);
	return { adapter, procedure, t };
}

export function serverTrpc(engine: RouterEngine) {
	return initTRPC.context<{ readonly requestId: string }>().create({
		errorFormatter: ({ shape, error }) => {
			if (!engine.customErrorShape) {
				return rejectionFormatter({ error, shape });
			}
			const original = { ...shape, data: { ...shape.data, requestId: engine.requestId } };
			const formatted = withRejection(original, error);
			engine.formatting.push({ formatted, original });
			return formatted;
		},
		transformer: superjson,
	});
}
