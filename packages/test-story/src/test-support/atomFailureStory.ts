import { Cause, Deferred, Effect, Fiber } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "#server/storyKit.ts";
import type { SignalNotReceived } from "#server/until.ts";
import { untilAtom } from "#server/untilAtom.ts";

export const atomFailures = storyKit({
	*create() {
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(owner) => Effect.sync(() => owner.dispose()),
		);
		const source = yield* Deferred.make<string, string>();
		const atom = Atom.make(Deferred.await(source));
		const wait: { fiber?: Fiber.Fiber<string, SignalNotReceived> } = {};
		return { atom, registry, source, wait };
	},
	name: "failed atom waits",
	stages: ["source"],
	verbs: (engine, story) => {
		function waitForAnswer() {
			story.tell("wait for the answer atom to succeed");
			return untilAtom(engine.atom, AsyncResult.isSuccess, { name: "answer" }).pipe(
				Effect.provideService(AtomRegistry.AtomRegistry, engine.registry),
				Effect.as("received an answer"),
				Effect.catchTag("AtomFailed", (error) => Effect.succeed(`${error._tag}: ${error.name}: ${Cause.squash(error.cause)}`)),
			);
		}
		return {
			beginWaiting: () =>
				waitForAnswer().pipe(
					Effect.forkScoped({ startImmediately: true }),
					Effect.tap((fiber) =>
						Effect.sync(() => {
							engine.wait.fiber = fiber;
						}),
					),
				),
			failSource: () => {
				story.tell("the answer source fails with unavailable");
				return Deferred.fail(engine.source, "unavailable");
			},
			outcome: () => {
				if (engine.wait.fiber === undefined) {
					return Effect.die("No answer wait started");
				}
				return Fiber.join(engine.wait.fiber);
			},
			waitForAnswer,
		};
	},
});

export const failedSource = atomFailures.trait("source", "the answer source has failed with unavailable", (engine) =>
	Deferred.fail(engine.source, "unavailable"),
);
