import { Cause, Option } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { useContext, useMemo } from "react";
import type { FieldRejection } from "@shivaedev/form/fieldRejection.ts";
import { FailureHostContext } from "#client/FailureHostContext.ts";
import { type Decision, decide } from "#client/failureDecision.ts";
import type { FailureChoices } from "#client/failures.ts";
import { NoticeContext } from "#client/NoticeContext.ts";
import type { NoticeDescriptor } from "#client/notices.ts";
import { unexpectedFailure } from "#client/unexpectedFailure.ts";
import { publishNotice } from "#noticeStore.ts";

const nothing = { _tag: "silent" } as const;
function noField(): undefined {
	return undefined;
}

// An operation's owner presents each settled invocation once, so a failure reaches the screen or the failure host once however many
// components read the same result. Its later success means the problem is solved, so the failure notices it published go.
export function useFeedback<R, E>(runtime: Atom.AtomRuntime<R, E> | undefined) {
	const store = useContext(NoticeContext);
	const host = useContext(FailureHostContext);
	return useMemo(() => {
		const published: (() => void)[] = [];
		function track(dismiss: (() => void) | undefined) {
			if (dismiss) {
				published.push(dismiss);
			}
		}
		return {
			failed: (
				cause: Cause.Cause<unknown>,
				input: unknown,
				choices: FailureChoices,
				field: (error: unknown) => FieldRejection<string> | undefined = noField,
			): Decision<R> => {
				const error = Cause.findErrorOption(cause);
				if (Option.isNone(error)) {
					if (Cause.hasDies(cause) && !choices.silent) {
						track(host?.(unexpectedFailure(cause)));
					}
					return nothing;
				}
				const decision = decide<R>(error.value, input, choices, field);
				if (decision._tag === "notice" && runtime) {
					track(publishNotice(store, runtime, decision.descriptor, "rejection"));
				} else if (decision._tag === "unexpected") {
					track(host?.(unexpectedFailure(cause)));
				}
				return decision;
			},
			succeeded: (descriptor: NoticeDescriptor<R> | undefined) => {
				for (const dismiss of published.splice(0)) {
					dismiss();
				}
				if (runtime) {
					publishNotice(store, runtime, descriptor, "success");
				}
			},
		};
	}, [host, runtime, store]);
}
