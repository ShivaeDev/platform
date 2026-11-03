import { Effect, Exit, Fiber, type Scope } from "effect";
import type { DirectTool, ToolOutcome } from "#tools.ts";

const closed: ToolOutcome = {
	ok: false,
	text: "the session that served this tool closed before the call finished",
};
export function callWhileOpen(tool: DirectTool, callId: string, args: unknown): Effect.Effect<ToolOutcome, never, Scope.Scope> {
	return Effect.flatMap(Effect.scope, (scope) =>
		tool.call(callId, args).pipe(
			Effect.forkIn(scope),
			Effect.flatMap(Fiber.await),
			Effect.flatMap((exit) => (Exit.hasInterrupts(exit) ? Effect.succeed(closed) : exit)),
		),
	);
}
