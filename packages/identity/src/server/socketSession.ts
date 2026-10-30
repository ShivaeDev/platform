import { Context, Deferred, type Duration, Effect, Option, type Scope } from "effect";
import type { Permission } from "@shivaedev/access/permission.ts";
import type { AuthUnavailable, Forbidden } from "@shivaedev/errors/taxonomy.ts";
import type { SessionShape } from "./session.ts";

export type SessionSnapshot = SessionShape & { readonly user: { readonly permissions?: readonly Permission[] } };
type Lookup = Effect.Effect<Option.Option<SessionSnapshot>, AuthUnavailable | Forbidden>;

export class SocketSession extends Context.Service<
	SocketSession,
	{
		readonly lookup: (key: object, lookup: Lookup) => Lookup;
		readonly monitor: <E, R>(check: Effect.Effect<void, E, R>) => Effect.Effect<never, E, R | Scope.Scope>;
	}
>()("@shivaedev/identity/SocketSession") {}

export const makeSocketSession = Effect.fnUntraced(function* (interval: Duration.Input) {
	const pending = new Map<object, Lookup>();
	const checks = new Set<Effect.Effect<void>>();
	yield* Effect.forever(
		Effect.sleep(interval).pipe(
			Effect.andThen(Effect.suspend(() => Effect.forEach([...checks], (check) => check, { concurrency: "unbounded", discard: true }))),
		),
	).pipe(Effect.forkScoped);
	return SocketSession.of({
		lookup: (key, lookup) =>
			Effect.gen(function* () {
				let batch = pending.get(key);
				if (batch === undefined) {
					batch = yield* Effect.cached(Effect.sleep(0).pipe(Effect.andThen(lookup), Effect.ensuring(Effect.sync(() => pending.delete(key)))));
					pending.set(key, batch);
				}
				return yield* batch;
			}),
		monitor: <E, R>(check: Effect.Effect<void, E, R>) =>
			Effect.gen(function* () {
				const context = yield* Effect.context<R>();
				const ended = yield* Deferred.make<never, E>();
				const run = check.pipe(
					Effect.provideContext(context),
					Effect.catchCause((cause) => Deferred.failCause(ended, cause)),
					Effect.asVoid,
				);
				yield* Effect.acquireRelease(
					Effect.sync(() => checks.add(run)),
					() => Effect.sync(() => checks.delete(run)),
				);
				return yield* Deferred.await(ended);
			}),
	});
});

export function revalidateSession<E, R>(check: Effect.Effect<void, E, R>, interval: Duration.Input) {
	return Effect.flatMap(
		Effect.serviceOption(SocketSession),
		Option.match({
			onNone: () => Effect.forever(Effect.sleep(interval).pipe(Effect.andThen(check))),
			onSome: (socket) => Effect.scoped(socket.monitor(check)),
		}),
	);
}
