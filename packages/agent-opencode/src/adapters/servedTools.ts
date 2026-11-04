import { Effect, Scope } from "effect";
import { callWhileOpen } from "#callWhileOpen.ts";
import type { DirectTool } from "#tools.ts";
export const servedTools = Effect.fnUntraced(function* (tools: readonly DirectTool[]) {
	const calls = yield* Effect.flatMap(Effect.scope, Scope.fork);
	const services = yield* Effect.context<never>();
	const run = Effect.runPromiseWith(services);
	return new Map(
		tools.map((tool) => [tool.name, (callId: string, args: unknown) => run(callWhileOpen(tool, callId, args).pipe(Scope.provide(calls)))]),
	);
});
