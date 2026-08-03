import type { TRPCError } from "@trpc/server";
import type { Effect } from "effect";

export type ProcedureKind = "mutation" | "query";

export interface ProcedureInfo {
	readonly captureStackTrace: () => string | undefined;
	readonly path: string;
	readonly type: ProcedureKind;
}

export interface EffectTRPCErrorContext extends ProcedureInfo {
	readonly origin: "defect" | "failure";
}

export type EffectTRPCErrorMapper = (
	error: unknown,
	context: EffectTRPCErrorContext,
) => TRPCError | undefined;

export type EffectTRPCInstrument = <A, E, R>(
	effect: Effect.Effect<A, E, R>,
	procedure: ProcedureInfo,
) => Effect.Effect<A, E, R>;
