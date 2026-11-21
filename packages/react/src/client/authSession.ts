import { Effect, Layer, Option, Schedule } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import {
	forgetSession,
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

export interface RememberedAuthSession<E> extends AuthSession<RememberedSession | null, E> {
	readonly signOut: <A, TError, R>(request: Effect.Effect<A, TError, R>) => Effect.Effect<A, TError, R>;
}

export type SessionRuntime = Pick<Atom.AtomRuntime<never, unknown>, "atom">;

export interface AuthSessionOptions {
	readonly runtime?: SessionRuntime | undefined;
}

export interface RememberedSessionOptions extends AuthSessionOptions {
	readonly remember: Layer.Layer<SessionMemory>;
}

const defaultRuntime = Atom.runtime(Layer.empty);
const retrySchedule = Schedule.min([Schedule.exponential("1 second"), Schedule.spaced("30 seconds")]);

// Sees the check through to an answer: a failed attempt waits out the schedule, and a visible online or
// visibilitychange event starts a fresh attempt and schedule at once.
function answered<A, E>(check: Atom.Atom<AsyncResult.AsyncResult<A, E>>, runtime: SessionRuntime) {
	return runtime
		.atom((get) => {
			function resume() {
				if (window.document.visibilityState === "visible") {
					get.refresh(check);
					get.refreshSelf();
				}
			}
			window.addEventListener("online", resume);
			window.addEventListener("visibilitychange", resume);
			get.addFinalizer(() => {
				window.removeEventListener("online", resume);
				window.removeEventListener("visibilitychange", resume);
			});
			const attempt = Effect.suspend(() => {
				if (!get.once(check).waiting) {
					get.refresh(check);
				}
				return get.resultOnce(check, { suspendOnWaiting: true });
			});
			return Effect.retry(Effect.sandbox(attempt), retrySchedule);
		})
		.pipe(Atom.setIdleTTL(0));
}

// While the check has not answered, it keeps retrying, and a failure reads as waiting so a screen can say it is trying again.
function retrying<A, E>(check: Atom.Atom<AsyncResult.AsyncResult<A, E>>, runtime: SessionRuntime) {
	const answer = answered(check, runtime);
	return Atom.readable(
		(get): AsyncResult.AsyncResult<A, E> => {
			const result = get(check);
			if (!result.waiting && AsyncResult.isSuccess(result)) {
				return result;
			}
			get(answer);
			return AsyncResult.isFailure(result) ? AsyncResult.waiting(result) : result;
		},
		(refresh) => refresh(check),
	);
}

function session<A, E>(check: Atom.Atom<AsyncResult.AsyncResult<A, E>>, atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>): AuthSession<A, E> {
	const refresh = Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		registry.refresh(check);
		return yield* AtomRegistry.getResult(registry, check, { suspendOnWaiting: true });
	});
	return { atom, refresh };
}

function remembering<E>(verified: Atom.Atom<AsyncResult.AsyncResult<RememberedSession | null, E>>, memory: Layer.Layer<SessionMemory>) {
	const recalled = Atom.make(Effect.provide(recallSession, memory));
	return Atom.readable(
		(get): AsyncResult.AsyncResult<RememberedSession | null, E> => {
			const remembered = Option.flatten(AsyncResult.value(get(recalled)));
			const current = get(verified);
			if (Option.isSome(AsyncResult.value(current)) || Option.isNone(remembered)) {
				return current;
			}
			if (AsyncResult.isFailure(current)) {
				return AsyncResult.failure(current.cause, {
					previousSuccess: Option.some(AsyncResult.success(remembered.value)),
					waiting: current.waiting,
				});
			}
			return AsyncResult.success(remembered.value, { waiting: true });
		},
		(refresh) => refresh(verified),
	);
}

export function authSession<E>(read: Effect.Effect<VerifiedSession | null, E>, options: RememberedSessionOptions): RememberedAuthSession<E>;
export function authSession<A, E>(read: Effect.Effect<A, E>, options?: AuthSessionOptions): AuthSession<A, E>;
export function authSession<A extends VerifiedSession | null, E>(
	read: Effect.Effect<A, E>,
	options: AuthSessionOptions | RememberedSessionOptions = {},
): AuthSession<A, E> | RememberedAuthSession<E> {
	const runtime = options.runtime ?? defaultRuntime;
	if (!("remember" in options)) {
		const check = Atom.make(read);
		return session(check, retrying(check, runtime));
	}
	const check = Atom.make(read.pipe(Effect.flatMap(rememberSession), Effect.provide(options.remember)));
	const forget = Effect.provide(forgetSession, options.remember);
	return {
		...session(check, remembering(retrying(check, runtime), options.remember)),
		signOut: (request) => Effect.tap(request, () => forget),
	};
}
