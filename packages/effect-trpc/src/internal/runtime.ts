import { TRPCError } from "@trpc/server";
import {
	Cause,
	Context,
	Effect,
	Exit,
	type ManagedRuntime,
	Option,
	Result,
} from "effect";
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

export const makeRuntimeBridge = <Requirements, RuntimeError>(
	runtime: ManagedRuntime.ManagedRuntime<Requirements, RuntimeError>,
	contextBridge: ContextBridge,
	options: {
		readonly instrument?: EffectTRPCInstrument;
		readonly mapError?: EffectTRPCErrorMapper;
	},
): RuntimeBridge<Requirements> => ({
	instrument: (effect, procedure) =>
		Effect.suspend(() =>
			options.instrument === undefined
				? effect
				: options.instrument(effect, procedure),
		),
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
		if (Cause.hasInterruptsOnly(exit.cause)) {
			throw new TRPCError({
				code: "CLIENT_CLOSED_REQUEST",
				message: "Request cancelled",
			});
		}

		const failure = Cause.findErrorOption(exit.cause);
		if (Option.isSome(failure)) {
			throw mapError(
				failure.value,
				"failure",
				runOptions.procedure,
				options.mapError,
			);
		}

		const defect = Cause.findDefect(exit.cause);
		if (Result.isSuccess(defect)) {
			throw mapError(
				defect.success,
				"defect",
				runOptions.procedure,
				options.mapError,
			);
		}

		throw internalError();
	},
});
