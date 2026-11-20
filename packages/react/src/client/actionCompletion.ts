import { RegistryContext } from "@effect/atom-react";
import { Cause, Effect, Option } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { useContext, useInsertionEffect, useMemo, useRef } from "react";
import { isUnauthorized } from "@shivaedev/errors/taxonomy.ts";
import { useFeedback } from "#client/adapters/useFeedback.ts";
import { useStableRun } from "#client/adapters/useStableRun.ts";
import type { BoundOperation } from "#client/boundOperation.ts";
import type { FailureChoices, FailuresOption } from "#client/failures.ts";
import type { NoticeDescriptor, NoticeFeedback } from "#client/notices.ts";
import { useSessionRecheck } from "#client/sessionBoundary.ts";

export interface ActionOptions<TInput, A, E, R = never> {
	readonly concurrent?: boolean;
	readonly notices?: NoticeFeedback<TInput, A, R>;
	readonly onFailure?: (error: E, input: TInput) => void;
	readonly onSuccess?: (value: A, input: TInput) => void;
}

export type OperationActionOptions<TInput, A, E, R, TSilent extends boolean = false> = ActionOptions<
	NoInfer<TInput>,
	NoInfer<A>,
	NoInfer<E>,
	NoInfer<R>
> &
	FailuresOption<E, TInput, NoticeDescriptor<R>, TSilent>;

export function useActionSource<TInput, A, E, R, TRuntimeError>(
	source: Atom.AtomResultFn<TInput, A, E> | BoundOperation<TInput, A, E, R, TRuntimeError>,
	options: ActionOptions<TInput, A, E, R> & FailureChoices,
): Atom.AtomResultFn<TInput, A, E | TRuntimeError> {
	// The operation object may be written inline, so its `run` and `runtime`, not the object, are the action's identity.
	const { native, run, runtime } =
		"runtime" in source ? { native: undefined, run: source.run, runtime: source.runtime } : { native: source, run: undefined, runtime: undefined };
	useStableRun(run);
	const registry = useContext(RegistryContext);
	const recheck = useSessionRecheck();
	const feedback = useFeedback(runtime);
	const latestRef = useRef({ options, recheck });
	useInsertionEffect(() => {
		latestRef.current = { options, recheck };
	}, [options, recheck]);
	const concurrent = options.concurrent;
	const owner = useMemo(() => {
		const lifetime = { active: false, registry };
		function rejected(cause: Cause.Cause<E>, input: TInput) {
			return Effect.gen(function* () {
				const error = Cause.findErrorOption(cause);
				if (lifetime.active && Option.exists(error, isUnauthorized)) {
					yield* Effect.sync(() => latestRef.current.recheck());
				}
				yield* Effect.sync(() => {
					if (lifetime.active) {
						const { options: latest } = latestRef.current;
						if (Option.isSome(error)) {
							latest.onFailure?.(error.value, input);
						}
						feedback.failed(cause, input, latest);
					}
				});
				return yield* Effect.failCause(cause);
			});
		}
		function completed(value: A, input: TInput) {
			return Effect.sync(() => {
				if (lifetime.active) {
					latestRef.current.options.onSuccess?.(value, input);
					feedback.succeeded(latestRef.current.options.notices?.onSuccess?.(value, input));
				}
				return value;
			});
		}
		function execute(input: TInput) {
			return Effect.suspend(() => {
				if (!run) {
					return Effect.die(new Error("Missing command Effect"));
				}
				return Effect.matchCauseEffect(run(input), {
					onFailure: (cause) => rejected(cause, input),
					onSuccess: (value) => completed(value, input),
				});
			});
		}
		const atom = runtime === undefined ? native : runtime.fn(execute, { concurrent });
		return { atom, lifetime };
	}, [native, runtime, run, registry, concurrent, feedback]);
	useInsertionEffect(() => {
		owner.lifetime.active = true;
		return () => {
			owner.lifetime.active = false;
		};
	}, [owner]);
	return owner.atom;
}
