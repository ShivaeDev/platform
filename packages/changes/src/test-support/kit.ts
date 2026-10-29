import { Deferred, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Publish } from "#publish.ts";
import { Note } from "./driverVerbs.ts";
import { type BatchEnding, COMMIT_REFUSED, createEngine, database, labels, type TransactionEnding } from "./engine.ts";
import { type Change, Current, makeDatabase } from "./fakeDatabase.ts";
import { verbs } from "./verbs.ts";

export const changes = storyKit({
	create: createEngine,
	inspect: (engine) => ({
		committed: Object.fromEntries([...engine.owners].map(([name, owner]) => [name, owner.committed])),
		committedSink: engine.committedSink,
		guardAsked: engine.guardAsked,
		hookCalls: engine.hookCalls,
		loggedErrors: engine.logs.errors.length,
		observed: engine.observed,
		published: engine.published,
		scopedSink: engine.scopedSink,
	}),
	name: "change channel",
	stages: ["owners", "channel"],
	verbs: (engine, story) => verbs(engine, story.tell),
});

export function hasOwner(name: string) {
	return changes.trait("owners", `${name} is a second database with its own transactions`, (engine) => {
		engine.owners.set(name, makeDatabase(name));
	});
}

export function transactionEnds(ending: TransactionEnding) {
	return changes.trait("owners", `the order transaction ends as ${ending}`, (engine) => {
		engine.transactionEnding = ending;
		if (ending === "commit failed") {
			database(engine, "main").commit = Effect.die(new Error(COMMIT_REFUSED));
		}
	});
}

export function commitWaits() {
	return changes.trait("owners", "main's database holds each commit until the story lets it finish", function* (engine) {
		const begun = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		engine.commitGate = { begun, release };
		database(engine, "main").commit = Effect.andThen(Deferred.succeed(begun, undefined), Deferred.await(release));
	});
}

export function batchEnds(ending: BatchEnding) {
	return changes.trait("owners", `the batch ${ending}`, (engine) => {
		engine.batchEnding = ending;
	});
}

export function guardWatches() {
	return changes.trait("channel", "the unowned guard notes each database it is asked about", (engine) => {
		engine.options.unowned = Effect.flatMap(Current, (owner) =>
			Effect.sync(() => {
				engine.guardAsked.push(owner.name);
			}),
		);
	});
}

export function guardRefuses() {
	return changes.trait("channel", "the unowned guard refuses work outside a transaction the channel owns", (engine) => {
		engine.options.unowned = Effect.die(new Error("a native transaction the channel does not own is open"));
	});
}

export function hookRecords() {
	return changes.trait("channel", "the configured before-commit hook notes the changes it sees", (engine) => {
		engine.options.beforeCommit = (entries: readonly Change[]) =>
			Effect.sync(() => {
				engine.hookCalls.push(`the configured hook sees ${labels(entries).join(", ")}`);
			});
	});
}

export function hookFails(reason: string) {
	return changes.trait("channel", `the before-commit hook fails: ${reason}`, (engine) => {
		engine.options.beforeCommit = () => Effect.fail(reason);
	});
}

export function hookWritesNote() {
	return changes.trait("channel", "the before-commit hook writes the note it is given as a row", (engine) => {
		engine.options.beforeCommit = () => Effect.flatMap(Note, (note) => Effect.flatMap(Current, (owner) => owner.write(note)));
	});
}

export type SinkFailure = "a failed Effect" | "a defect" | "a synchronous throw";

function failingSink(failure: SinkFailure, reason: string): Publish<Change, Current> {
	switch (failure) {
		case "a failed Effect":
			return () => Effect.fail(new Error(reason));
		case "a defect":
			return () => Effect.die(new Error(reason));
		case "a synchronous throw":
			return () => {
				throw new Error(reason);
			};
	}
}

export function sinkFails(failure: SinkFailure, reason: string) {
	return changes.trait("channel", `the configured sink fails with ${failure}: ${reason}`, (engine) => {
		engine.options.publish = failingSink(failure, reason);
	});
}

export function failedPublishDies() {
	return changes.trait("channel", "the channel turns a failed publish into a defect", (engine) => {
		engine.options.onPublishFailure = "die";
	});
}
