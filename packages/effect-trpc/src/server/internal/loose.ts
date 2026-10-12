import type { ProcedureBuilderOf, ProcedureBuilderSurface, ResolverContext } from "./procedureTypes.ts";
export function looseBuilder<TContext, TMeta, TContextOverrides, TInputIn, TInputOut, TOutputIn, TOutputOut>(
	builder: ProcedureBuilderOf<TContext, TMeta, TContextOverrides, TInputIn, TInputOut, TOutputIn, TOutputOut>,
): ProcedureBuilderSurface<ResolverContext<TContext, TMeta, TContextOverrides>>;
export function looseBuilder(builder: unknown): unknown {
	return builder;
}
// tRPC runs the procedure's input parsers before the resolver, so the resolver receives the input it declared.
export function acceptParsedInput<TResult>(resolver: (input: never) => TResult): (input: unknown) => TResult;
export function acceptParsedInput(resolver: unknown): unknown {
	return resolver;
}
