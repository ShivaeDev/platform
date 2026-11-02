import { Effect } from "effect";
import type { Observation } from "#observe.ts";
import { type Body, effectOf } from "./body.ts";
import { type Engine, labels } from "./engine.ts";
import type { Change } from "./fakeDatabase.ts";

export function observationVerbs(engine: Engine) {
	const channel = engine.channel();
	function observe(observation: Observation<Change>) {
		return Effect.sync(() => {
			const line = `${labels(observation.changes).join(", ")} ${observation._tag.toLowerCase()}`;
			engine.observed.push(line);
			engine.timeline.push(`the observer sees ${line}`);
		});
	}

	return {
		committedSinkReceived: () => Effect.sync(() => [...engine.committedSink]),
		guardAsked: () => Effect.sync(() => [...engine.guardAsked]),
		hookCalls: () => Effect.sync(() => [...engine.hookCalls]),
		loggedErrors: () => Effect.sync(() => [...engine.logs.errors]),
		observed: () => Effect.sync(() => [...engine.observed]),
		observing: <A, E, R>(body: Body<A, E, R>) => Effect.provideService(effectOf(body), channel.Observer, observe),
		published: () => Effect.sync(() => engine.published.map((changes) => [...changes])),
		publishedInAnyOrder: () => Effect.sync(() => engine.published.map((changes) => [...changes].sort((left, right) => left.localeCompare(right)))),
		scopedSinkReceived: () => Effect.sync(() => [...engine.scopedSink]),
		timeline: () => Effect.sync(() => [...engine.timeline]),
		withCommittedSink: <A, E, R>(body: Body<A, E, R>) =>
			Effect.provideService(effectOf(body), channel.CommittedSink, (changes: readonly Change[]) =>
				Effect.sync(() => {
					engine.committedSink.push(labels(changes));
				}),
			),
		withFailingObserver: <A, E, R>(failure: "a synchronous throw" | "a defect", event: Observation<Change>["_tag"], body: Body<A, E, R>) =>
			Effect.provideService(effectOf(body), channel.Observer, (observation) => {
				if (observation._tag !== event) {
					return observe(observation);
				}
				if (failure === "a synchronous throw") {
					throw new Error("the observer failed");
				}
				return Effect.die(new Error("the observer failed"));
			}),
		withScopedHook: <A, E, R>(body: Body<A, E, R>) =>
			Effect.provideService(effectOf(body), channel.BeforeCommit, (changes: readonly Change[]) =>
				Effect.sync(() => {
					engine.hookCalls.push(`the scoped hook sees ${labels(changes).join(", ")}`);
				}),
			),
		withScopedSink: <A, E, R>(body: Body<A, E, R>) =>
			Effect.provideService(effectOf(body), channel.Sink, (changes: readonly Change[]) =>
				Effect.sync(() => {
					engine.scopedSink.push(labels(changes));
				}),
			),
	};
}
