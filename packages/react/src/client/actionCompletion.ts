import { RegistryContext } from "@effect/atom-react";
import { Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { useContext, useInsertionEffect, useMemo, useRef } from "react";
import { isUnauthorized } from "@shivaedev/errors/taxonomy.ts";
import type { AtomServices } from "#AtomServices.ts";
import { NoticeContext } from "#NoticeContext.ts";
import { publishNotice } from "#noticeStore.ts";
import type { NoticeFeedback } from "#notices.ts";
import { useSessionRecheck } from "./sessionBoundary.ts";

export interface ActionOptions<TInput, A, E, R = never> {
	readonly concurrent?: boolean;
	readonly notices?: NoticeFeedback<TInput, A, E, R>;
	readonly onFailure?: (error: E, input: TInput) => void;
	readonly onSuccess?: (value: A, input: TInput) => void;
}

export function useActionSource<TInput, A, E, R, TRuntimeError>(
	source: Atom.AtomResultFn<TInput, A, E> | Atom.AtomRuntime<R, TRuntimeError>,
	run: ((input: TInput) => Effect.Effect<A, E, AtomServices<R>>) | undefined,
	options: ActionOptions<TInput, A, E, R>,
): Atom.AtomResultFn<TInput, A, E | TRuntimeError> {
	const registry = useContext(RegistryContext);
	const recheck = useSessionRecheck();
	const notices = useContext(NoticeContext);
	const latestRef = useRef({ options, recheck });
	useInsertionEffect(() => {
		latestRef.current = { options, recheck };
	}, [options, recheck]);
	const concurrent = options.concurrent;
	const owner = useMemo(() => {
		const lifetime = { active: false, registry };
		function rejected(error: E, input: TInput) {
			return Effect.gen(function* () {
				if (lifetime.active && isUnauthorized(error)) {
					yield* Effect.sync(() => latestRef.current.recheck());
				}
				yield* Effect.sync(() => {
					if (lifetime.active) {
						latestRef.current.options.onFailure?.(error, input);
						if ("fn" in source) {
							publishNotice(notices, source, latestRef.current.options.notices?.onFailure?.(error, input));
						}
					}
				});
				return yield* Effect.fail(error);
			});
		}
		function completed(value: A, input: TInput) {
			return Effect.sync(() => {
				if (lifetime.active) {
					latestRef.current.options.onSuccess?.(value, input);
					if ("fn" in source) {
						publishNotice(notices, source, latestRef.current.options.notices?.onSuccess?.(value, input));
					}
				}
				return value;
			});
		}
		function execute(input: TInput) {
			return Effect.suspend(() => {
				if (!run) {
					return Effect.die(new Error("Missing command Effect"));
				}
				return Effect.matchEffect(run(input), {
					onFailure: (error) => rejected(error, input),
					onSuccess: (value) => completed(value, input),
				});
			});
		}
		const atom = "fn" in source ? source.fn(execute, { concurrent }) : source;
		return { atom, lifetime };
	}, [source, run, registry, concurrent, notices]);
	useInsertionEffect(() => {
		owner.lifetime.active = true;
		return () => {
			owner.lifetime.active = false;
		};
	}, [owner]);
	return owner.atom;
}
