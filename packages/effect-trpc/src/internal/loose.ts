import type { ProcedureBuilderOf, ProcedureBuilderSurface, ResolverContext } from "./procedure-types.ts";

export function looseBuilder<Context, Meta, ContextOverrides, InputIn, InputOut, OutputIn, OutputOut>(
	builder: ProcedureBuilderOf<Context, Meta, ContextOverrides, InputIn, InputOut, OutputIn, OutputOut>,
): ProcedureBuilderSurface<ResolverContext<Context, Meta, ContextOverrides>>;
export function looseBuilder(builder: unknown): unknown {
	return builder;
}

// tRPC runs the procedure's input parsers before the resolver, so the resolver receives the input it declared.
export function acceptParsedInput<Result>(resolver: (input: never) => Result): (input: unknown) => Result;
export function acceptParsedInput(resolver: unknown): unknown {
	return resolver;
}
