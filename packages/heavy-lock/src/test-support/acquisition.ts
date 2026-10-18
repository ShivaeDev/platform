import { Context, Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect";
import { acquireHeavyLock } from "#acquire.ts";
import { HeldLock } from "#HeldLock.ts";
import { readSettings } from "#settings.ts";
import { heavyLockLayer } from "#withHeavyLock.ts";
import { configured, type Lock } from "./lock.ts";
import { type RunningCommand, startCommand } from "./runningCommand.ts";

export function acquisition(engine: Lock, tell: (line: string) => void) {
	function openScope() {
		tell("a scope opens");
		return Effect.acquireRelease(Scope.make(), (current) => Scope.close(current, Exit.void));
	}
	return {
		acquire: (scope: Scope.Closeable) => {
			tell("acquireHeavyLock takes the lock in the open scope");
			return configured(engine, acquireHeavyLock(engine.options)).pipe(Effect.provideService(Scope.Scope, scope));
		},
		buildLayer: () =>
			Effect.gen(function* () {
				tell("the lock layer is built in a new scope");
				const scope = yield* openScope();
				const context = yield* configured(engine, Layer.buildWithScope(heavyLockLayer(engine.options), scope));
				return { context, scope };
			}),
		closeLayer: (layer: { scope: Scope.Closeable }) => {
			tell("the layer's scope closes");
			return Scope.close(layer.scope, Exit.void);
		},
		closeScope: (scope: Scope.Closeable) => {
			tell("the surrounding scope closes");
			return Scope.close(scope, Exit.void);
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
		openScope,
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
