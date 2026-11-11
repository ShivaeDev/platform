import { Cause, Effect } from "effect";
import { makeRuleStory } from "@shivaedev/quality/testing/ruleStory.ts";

export const ruleKit = makeRuleStory();
export const { repositoryHas } = ruleKit;

export function ruleFailure<A, E, R>(check: Effect.Effect<A, E, R>) {
	return Effect.matchCause(check, {
		onFailure: (cause) => {
			const failure = Cause.squash(cause);
			return failure instanceof Error ? failure.message : String(failure);
		},
		onSuccess: () => undefined,
	});
}
