import { RegistryContext } from "@effect/atom-react";
import { Effect, Predicate } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { useContext, useInsertionEffect, useMemo, useRef } from "react";
import type { AtomServices } from "#fieldRejection.ts";
import { useSessionRecheck } from "./sessionBoundary.ts";

export interface ActionOptions<TInput, A, E> {
	readonly concurrent?: boolean;
	readonly onFailure?: (error: E, input: TInput) => void;
	readonly onSuccess?: (value: A, input: TInput) => void;
}

export function useActionSource<TInput, A, E, R, TRuntimeError>(
	source: Atom.AtomResultFn<TInput, A, E> | Atom.AtomRuntime<R, TRuntimeError>,
	run: ((input: TInput) => Effect.Effect<A, E, AtomServices<R>>) | undefined,
	options: ActionOptions<TInput, A, E>,
): Atom.AtomResultFn<TInput, A, E | TRuntimeError> {
	const registry = useContext(RegistryContext);
	const recheck = useSessionRecheck();
	const latestRef = useRef({ options, recheck, run });
	useInsertionEffect(() => {
		latestRef.current = { options, recheck, run };
	}, [options, recheck, run]);
	const concurrent = options.concurrent;
	const owner = useMemo(() => {
		const lifetime = { active: false, registry };
		function rejected(error: E, input: TInput) {
			return Effect.gen(function* () {
				if (lifetime.active && Predicate.isTagged(error, "Unauthorized")) {
					yield* Effect.sync(() => latestRef.current.recheck());
				}
				yield* Effect.sync(() => {
					if (lifetime.active) {
						latestRef.current.options.onFailure?.(error, input);
					}
				});
				return yield* Effect.fail(error);
			});
		}
		function completed(value: A, input: TInput) {
			return Effect.sync(() => {
				if (lifetime.active) {
					latestRef.current.options.onSuccess?.(value, input);
				}
				return value;
			});
		}
		function execute(input: TInput) {
			return Effect.suspend(() => {
				const command = latestRef.current.run;
				if (!command) {
					return Effect.die(new Error("Missing command Effect"));
				}
				return Effect.matchEffect(command(input), {
					onFailure: (error) => rejected(error, input),
					onSuccess: (value) => completed(value, input),
				});
			});
		}
		const atom = "fn" in source ? source.fn(execute, { concurrent }) : source;
		return { atom, lifetime };
	}, [source, registry, concurrent]);
	useInsertionEffect(() => {
		owner.lifetime.active = true;
		return () => {
			owner.lifetime.active = false;
		};
	}, [owner]);
	return owner.atom;
}
