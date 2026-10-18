import { Context, Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect";
import { HeldLock } from "#held-lock.ts";
import { readSettings } from "#settings.ts";
import { heavyLockLayer } from "#with-heavy-lock.ts";
import { configured, type Lock } from "./lock.ts";
import { type RunningCommand, startCommand } from "./runningCommand.ts";

export function acquisition(engine: Lock, tell: (line: string) => void) {
	return {
		buildLayer: () =>
			Effect.gen(function* () {
				tell("the lock layer is built in a new scope");
				const scope = yield* Effect.acquireRelease(Scope.make(), (current) => Scope.close(current, Exit.void));
				const context = yield* configured(engine, Layer.buildWithScope(heavyLockLayer(engine.options), scope));
				return { context, scope };
			}),
		closeLayer: (layer: { scope: Scope.Closeable }) => {
			tell("the layer's scope closes");
			return Scope.close(layer.scope, Exit.void);
		},
		complete: (command: RunningCommand) => {
			tell("the command completes");
			return Deferred.succeed(command.completion, undefined);
		},
		environment: (command: RunningCommand) => Effect.map(Deferred.await(command.acquired), (context) => Context.get(context, HeldLock).env),
		exit: (command: RunningCommand) => Fiber.await(command.fiber),
		fail: (command: RunningCommand, error: string) => {
			tell(`the command fails: ${error}`);
			return Deferred.fail(command.completion, error);
		},
		interrupt: (command: RunningCommand) => {
			tell("the command is interrupted");
			return Fiber.interrupt(command.fiber);
		},
		join: (command: RunningCommand) => Fiber.join(command.fiber),
		readSettings: () => Effect.exit(configured(engine, readSettings(undefined))),
		start: () => {
			tell("a command starts acquiring the lock");
			return startCommand(engine);
		},
		startNested: (parent: RunningCommand) =>
			Effect.gen(function* () {
				tell("a nested command starts under the parent's hold");
				return yield* startCommand(engine, yield* Deferred.await(parent.acquired));
			}),
	};
}
