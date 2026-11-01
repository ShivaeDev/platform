import process from "node:process";
import { Cause, Context, Effect, Exit, Fiber, Layer, Scope } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { resolveHost } from "#host/config.ts";
import { mergeTreeConflicts, predictedMergeConflicts } from "#host/gitMergeTree.ts";
import { gitMainSource, MainSource } from "#host/mainSource.ts";
import { reportRevision } from "#host/reportRevision.ts";
import { gitScopeRepository } from "#test/gitScopeRepository.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";

function callOutcome(exit: Exit.Exit<unknown, unknown>) {
	return Exit.match(exit, {
		onFailure: (cause) => (Cause.hasInterruptsOnly(cause) ? "interrupted" : "failed"),
		onSuccess: () => "completed",
	});
}

export const gitScopeStory = storyKit({
	clock: "live",
	create: () =>
		Effect.gen(function* () {
			const repository = yield* gitScopeRepository;
			const host = resolveHost(repository.cwd, { database: syntheticDatabase, provider: "local" });
			const main = Context.get(yield* Layer.build(gitMainSource(host)), MainSource);
			return { main, repository };
		}),
	name: "Fleet scoped Git",
	stages: [],
	verbs: ({ main, repository }, story) => ({
		ancestry: (base: string, head: string) => reportRevision(repository.cwd, "origin")(base, head),
		breakRemote: () => repository.breakRemote(),
		fetch: () => main.latest,
		hold: (command: string) => {
			story.tell(`hold real Git ${command} while it opens its trace FIFO`);
			repository.hold(command);
		},
		merge: (head: string, other: string) => mergeTreeConflicts(repository.cwd, head, other),
		pending: () => repository.pending,
		prediction: (head: string, other: string) => predictedMergeConflicts(repository.cwd, repository.base, head, [other]),
		processExists: () =>
			Effect.sync(() => {
				try {
					process.kill(repository.pid(), 0);
					return true;
				} catch (error) {
					if (error instanceof Error && "code" in error && error.code === "ESRCH") {
						return false;
					}
					throw error;
				}
			}),
		revisions: () => ({ base: repository.base, left: repository.left, right: repository.right, tree: repository.tree }),
		start: (call: Effect.Effect<unknown, unknown>) =>
			Effect.gen(function* () {
				story.tell("start the Git call in its own scope");
				const scope = yield* Scope.make();
				yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
				const fiber = yield* call.pipe(Effect.forkIn(scope));
				return {
					close: () => Scope.close(scope, Exit.void),
					outcome: () => Fiber.await(fiber).pipe(Effect.map(callOutcome)),
				};
			}),
	}),
});
