import { Effect, Option } from "effect";
import type { Fleet } from "#fleet.ts";
import type { EngineFixture } from "#test/engine.ts";
import { PR, REPORT } from "#test/githubResult.ts";
import type { mergedReviewGithub } from "#test/mergedReviewGithub.ts";

export function foreignPrVerbs(
	fixture: EngineFixture,
	fleet: typeof Fleet.Service,
	github: Option.Option<Effect.Success<ReturnType<typeof mergedReviewGithub>>>,
	story: { readonly tell: (message: string) => void },
) {
	return {
		answerDecision: Effect.fnUntraced(function* (workId: string, action: "retry" | "release") {
			story.tell(`the human answers ${workId}'s decision with ${action}`);
			const decision = (yield* fleet.get(workId)).value.decision;
			if (decision === undefined) {
				return yield* Effect.die(new Error(`No decision to answer for ${workId}`));
			}
			return yield* fleet.resolve(workId, decision.id, fixture.respond(decision.id, action));
		}),
		closePrOnGithub: () => {
			story.tell("the PR is closed without merging on GitHub");
			Option.getOrThrow(github).state.status = "CLOSED";
		},
		finishWorker: Effect.fnUntraced(function* (workId: string) {
			story.tell(`the worker for ${workId} finishes with its PR report`);
			const receipt = (yield* fleet.get(workId)).value.attempts.at(-1)?.receipt;
			const observation = receipt === undefined ? undefined : fixture.observations.get(receipt.turnId);
			if (observation === undefined) {
				return yield* Effect.die(new Error(`No worker turn to finish for ${workId}`));
			}
			fixture.observations.set(observation.receipt.turnId, { ...observation, execution: "completed", output: REPORT });
		}),
		githubRequests: () => Option.getOrThrow(github).requests,
		launched: fixture.launched,
		mergePrOnGithub: () => {
			story.tell("the PR is merged on GitHub");
			Option.getOrThrow(github).state.status = "MERGED";
		},
		movePrHeadOnGithub: (head: string) => {
			story.tell(`the PR head moves to ${head} on GitHub`);
			Option.getOrThrow(github).state.head = head;
		},
		reservations: fixture.foreignReservations,
		reservePr: () => {
			story.tell("the PR reserves open-PR backlog");
			return fixture.foreign(PR);
		},
	};
}
