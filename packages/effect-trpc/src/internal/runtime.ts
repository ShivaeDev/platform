import { TRPCError } from "@trpc/server";
import { Cause, Context, Effect, Exit, Option, Result, Stream } from "effect";
import type { EffectTRPCRuntime } from "../adapter.js";
import type {
	EffectTRPCErrorMapper,
	EffectTRPCInstrument,
	ProcedureInfo,
} from "../types.js";
import type { ContextBridge } from "./context-bridge.js";

interface RunEffectOptions {
	readonly procedure: ProcedureInfo;
	readonly signal?: AbortSignal;
}

export interface RuntimeBridge<Requirements> {
	readonly instrument: EffectTRPCInstrument;
	readonly runEffect: <Value>(
		effect: Effect.Effect<Value, unknown, Requirements>,
		options: RunEffectOptions,
	) => Promise<Value>;
	readonly runStream: <Value>(
		stream: Stream.Stream<Value, unknown, Requirements>,
		options: RunEffectOptions,
	) => Promise<AsyncIterable<Value>>;
}

const internalError = (cause?: unknown): TRPCError =>
	new TRPCError({
		cause,
		code: "INTERNAL_SERVER_ERROR",
		message: "Internal server error",
	});

const mapError = (
	error: unknown,
	origin: "defect" | "failure",
	procedure: ProcedureInfo,
	consumerMapper: EffectTRPCErrorMapper | undefined,
): TRPCError => {
	if (error instanceof TRPCError) {
		return error;
	}

	try {
		return (
			consumerMapper?.(error, { ...procedure, origin }) ?? internalError(error)
		);
	} catch (mapperDefect) {
		return internalError(mapperDefect);
	}
};

const mapCause = (
	cause: Cause.Cause<unknown>,
	procedure: ProcedureInfo,
	consumerMapper: EffectTRPCErrorMapper | undefined,
): TRPCError => {
	if (Cause.hasInterruptsOnly(cause)) {
		return new TRPCError({
			code: "CLIENT_CLOSED_REQUEST",
			message: "Request cancelled",
		});
	}

	const failure = Cause.findErrorOption(cause);
	if (Option.isSome(failure)) {
		return mapError(failure.value, "failure", procedure, consumerMapper);
	}

	const defect = Cause.findDefect(cause);
	if (Result.isSuccess(defect)) {
		return mapError(defect.success, "defect", procedure, consumerMapper);
	}

	return internalError();
};

const interruptOn = (signal: AbortSignal | undefined): Effect.Effect<void> => {
	if (signal === undefined) return Effect.never;
	return Effect.callback<void>((resume) => {
		if (signal.aborted) {
			resume(Effect.void);
			return;
		}
		const abort = () => resume(Effect.void);
		signal.addEventListener("abort", abort, { once: true });
		return Effect.sync(() => signal.removeEventListener("abort", abort));
	});
};

export const makeRuntimeBridge = <Requirements, RuntimeError>(
	runtime: EffectTRPCRuntime<Requirements, RuntimeError>,
	contextBridge: ContextBridge,
	options: {
		readonly instrument?: EffectTRPCInstrument;
		readonly instrumentStream?: import("../types.js").EffectTRPCStreamInstrument;
		readonly mapError?: EffectTRPCErrorMapper;
	},
): RuntimeBridge<Requirements> => ({
	instrument: (effect, procedure) =>
		Effect.suspend(() =>
			options.instrument === undefined
				? effect
				: options.instrument(effect, procedure),
		),
	runStream: async (stream, runOptions) => {
		const instrumented = Stream.suspend(() =>
			options.instrumentStream === undefined
				? stream
				: options.instrumentStream(stream, runOptions.procedure),
		).pipe(
			Stream.withSpan(runOptions.procedure.path, {
				attributes: {
					"rpc.method": runOptions.procedure.path,
					"rpc.system": "trpc",
					"trpc.type": runOptions.procedure.type,
				},
				captureStackTrace: runOptions.procedure.captureStackTrace,
			}),
			Stream.interruptWhen(interruptOn(runOptions.signal)),
			Stream.catchCause((cause) =>
				Stream.fail(mapCause(cause, runOptions.procedure, options.mapError)),
			),
		);
		const context = await runtime.runPromise(Effect.context<Requirements>());
		const ambient = contextBridge.current();
		const provided =
			ambient === undefined ? context : Context.merge(context, ambient);
		return Stream.toAsyncIterableWith(instrumented, provided);
	},
	runEffect: async (effect, runOptions) => {
		const traced = effect.pipe(
			Effect.withSpan(
				runOptions.procedure.path,
				{
					attributes: {
						"rpc.method": runOptions.procedure.path,
						"rpc.system": "trpc",
						"trpc.type": runOptions.procedure.type,
					},
				},
				{
					captureStackTrace: runOptions.procedure.captureStackTrace,
				},
			),
		);
		const ambient = contextBridge.current();
		const runnable =
			ambient === undefined
				? traced
				: Effect.flatMap(runtime.contextEffect, (base) =>
						Effect.provideContext(traced, Context.merge(base, ambient)),
					);
		const exit = await runtime.runPromiseExit(
			runnable,
			runOptions.signal === undefined
				? undefined
				: { signal: runOptions.signal },
		);

		if (Exit.isSuccess(exit)) {
			return exit.value;
		}
		throw mapCause(exit.cause, runOptions.procedure, options.mapError);
	},
});
