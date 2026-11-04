import type { Effect, Schema } from "effect";
import type { Rpc, RpcMiddleware } from "effect/rpc";
import type { subjectMiddleware } from "#internal/subjectMiddleware.ts";

export interface SubjectDeclaration {
	readonly error: Schema.Top;
	readonly middleware: Effect.Effect<RpcMiddleware.Any, never, unknown>;
}

export type SubjectProvides<TSubject extends SubjectDeclaration> =
	Effect.Success<TSubject["middleware"]> extends RpcMiddleware.RpcMiddleware<infer TProvides, infer _E, infer _R> ? TProvides : never;

export type WithSubject<TRpcs extends Rpc.Any, TSubject extends SubjectDeclaration | undefined> = TSubject extends SubjectDeclaration
	? Rpc.AddMiddleware<TRpcs, ReturnType<typeof subjectMiddleware<TSubject>>>
	: TRpcs;
