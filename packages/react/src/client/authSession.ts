import { Effect, type Layer, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import {
	type RememberedSession,
	recallSession,
	rememberSession,
	type SessionMemory,
	type VerifiedSession,
} from "@shivaedev/identity/client/SessionMemory.ts";

export interface AuthSession<A, E> {
	readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
	readonly refresh: Effect.Effect<A, E, AtomRegistry.AtomRegistry>;
}

export interface AuthSessionOptions {
	readonly remember: Layer.Layer<SessionMemory>;
}

function refreshing<A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>): AuthSession<A, E> {
	const refresh = Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		registry.refresh(atom);
		return yield* AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true });
	});
	return { atom, refresh };
}

function remembering<E>(read: Effect.Effect<VerifiedSession | null, E>, memory: Layer.Layer<SessionMemory>) {
	const recalled = Atom.make(Effect.provide(recallSession, memory));
	const check = Atom.make(read.pipe(Effect.flatMap(rememberSession), Effect.provide(memory)));
	return Atom.readable(
		(get): AsyncResult.AsyncResult<RememberedSession | null, E> => {
			const remembered = Option.flatten(AsyncResult.value(get(recalled)));
			const verified = get(check);
			if (Option.isSome(AsyncResult.value(verified)) || Option.isNone(remembered)) {
				return verified;
			}
			if (AsyncResult.isFailure(verified)) {
				return AsyncResult.failure(verified.cause, {
					previousSuccess: Option.some(AsyncResult.success(remembered.value)),
					waiting: verified.waiting,
				});
			}
			return AsyncResult.success(remembered.value, { waiting: true });
		},
		(refresh) => refresh(check),
	);
}

export function authSession<A, E>(read: Effect.Effect<A, E>): AuthSession<A, E>;
export function authSession<E>(read: Effect.Effect<VerifiedSession | null, E>, options: AuthSessionOptions): AuthSession<RememberedSession | null, E>;
export function authSession<A extends VerifiedSession | null, E>(
	read: Effect.Effect<A, E>,
	options?: AuthSessionOptions,
): AuthSession<A, E> | AuthSession<RememberedSession | null, E> {
	return options === undefined ? refreshing(Atom.make(read)) : refreshing(remembering(read, options.remember));
}
