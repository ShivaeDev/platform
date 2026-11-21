import { type Context, Deferred, Effect } from "effect";

interface RecordedLog {
	readonly message: readonly unknown[];
}

export interface Construction {
	captured: Context.Context<never> | undefined;
	readonly forkedLogged: Deferred.Deferred<void>;
	logs: boolean;
	readonly release: Deferred.Deferred<void>;
}

// A credential-shaped name and a field the members model marks sensitive, written where an application could write them.
const member = { address: "1 Elm Street", password: "construction-secret" };

export function makeConstruction(): Construction {
	return { captured: undefined, forkedLogged: Deferred.makeUnsafe(), logs: false, release: Deferred.makeUnsafe() };
}

// Runs inside the application Effect after it built the module services: it logs, forks a fiber that logs once released,
// and keeps its context the way a service that bridges to callbacks would.
export const logDuringConstruction = Effect.fnUntraced(function* (construction: Construction) {
	if (!construction.logs) {
		return;
	}
	yield* Effect.logInfo("application constructing", member);
	yield* Effect.forkScoped(
		Deferred.await(construction.release).pipe(
			Effect.andThen(Effect.logInfo("forked application fiber", member)),
			Effect.andThen(Deferred.succeed(construction.forkedLogged, undefined)),
		),
	);
	construction.captured = yield* Effect.context<never>();
});

export function constructionVerbs(construction: Construction, logs: readonly RecordedLog[], story: { readonly tell: (line: string) => void }) {
	function logged(message: string) {
		return Effect.sync(() => logs.find((entry) => entry.message[0] === message)?.message[1] ?? `no log ${message}`);
	}
	return {
		capturedContextLog: () => {
			story.tell("a service logs through the context it captured while the application Effect ran");
			const captured = construction.captured;
			if (captured === undefined) {
				return Effect.die("The application Effect did not capture its context");
			}
			return Effect.logInfo("captured application context", member).pipe(
				Effect.provideContext(captured),
				Effect.andThen(logged("captured application context")),
			);
		},
		constructionLog: () => logged("application constructing"),
		forkedFiberLog: () => {
			story.tell("the fiber the application Effect forked is released and logs");
			return Deferred.succeed(construction.release, undefined).pipe(
				Effect.andThen(Deferred.await(construction.forkedLogged)),
				Effect.andThen(logged("forked application fiber")),
			);
		},
	};
}
