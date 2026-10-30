import { Effect, Stream, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { LiveConnection } from "#automaticLive.ts";
import type { QueryReference } from "#serverMetadata.ts";
import { answered, failure, thrown, times } from "./answers.ts";
import { reRead } from "./reRead.ts";
import { type Person, type PreferenceView, type SessionEngine, sessionEngine } from "./sessionEngine.ts";
import { settled, signal } from "./settle.ts";

const READ_LABELS: Record<PreferenceView, string> = { list: "list", "preference 1": "get:1", preferences: "self" };

function referenceWords(reference: QueryReference) {
	switch (reference.query) {
		case "self":
			return "preferences";
		case "get":
			return "preference 1";
		default:
			return reference.query;
	}
}

function shownOf(engine: SessionEngine, person: Person, view: PreferenceView) {
	const client = engine.clients[person];
	return Effect.map(settled(client.registry, client.view(view)), (result) => {
		if (AsyncResult.isSuccess(result)) {
			return result.value;
		}
		return AsyncResult.isFailure(result) ? failure(result.cause) : "still loading";
	});
}

function countOf(reads: readonly string[], person: Person, view: PreferenceView) {
	return reads.filter((read) => read === `${person}:${READ_LABELS[view]}`).length;
}

function readsOf(engine: SessionEngine, person: Person, view: PreferenceView) {
	return Effect.map(SubscriptionRef.get(engine.reads), (reads) => countOf(reads, person, view));
}

// Actions mark each watched view first, so a later wait for its re-read cannot miss one that finished before the wait began.
function mark(engine: SessionEngine) {
	const reads = Effect.runSync(SubscriptionRef.get(engine.reads));
	for (const [key, { person, view }] of engine.mounted) {
		const client = engine.clients[person];
		engine.marked.set(key, { reads: countOf(reads, person, view), shown: client.registry.get(client.view(view)) });
	}
}

const untilSubscriptionsChange = Effect.fnUntraced(function* (engine: SessionEngine, act: () => void) {
	const before = yield* SubscriptionRef.get(engine.subscriptions);
	act();
	yield* signal(SubscriptionRef.changes(engine.subscriptions), (current) => current !== before);
});

const watch = Effect.fnUntraced(function* (engine: SessionEngine, person: Person, views: readonly PreferenceView[]) {
	const client = engine.clients[person];
	for (const view of views) {
		engine.mounted.set(`${person} ${view}`, { person, release: client.registry.mount(client.view(view)), view });
	}
	for (const view of views) {
		yield* shownOf(engine, person, view);
	}
});

function untilPending(engine: SessionEngine, person: Person) {
	const client = engine.clients[person];
	return signal(AtomRegistry.toStream(client.registry, client.api[LiveConnection].status), (status) => status.pending > 0);
}

function saveOf(engine: SessionEngine, person: Person, title: string, runtime: Person = person) {
	return engine.clients[runtime].run(engine.clients[person].api.save.run({ title }));
}

export const sessionStory = storyKit({
	clock: "live",
	create: () => sessionEngine,
	inspect: (engine) => ({
		reads: Effect.runSync(SubscriptionRef.get(engine.reads)),
		stored: Object.fromEntries(engine.stored),
		subscriptions: Effect.runSync(SubscriptionRef.get(engine.subscriptions)),
	}),
	name: "session contract",
	stages: ["views", "after"],
	verbs: (engine, story) => ({
		announce: (person: Person) => {
			story.tell(`the server announces a change to ${person}'s preferences`);
			mark(engine);
			return engine.announce(person);
		},
		bindWithoutOwner: () => {
			story.tell("the client binds the session contract without an owning registry");
			return thrown(() => engine.clients.alice.withoutOwner());
		},
		changeQuietly: (person: Person, title: string) => {
			story.tell(`${person}'s preferences become ${title} on the server without any hint`);
			engine.stored.set(person, title);
		},
		connectInBobsRegistry: () => {
			story.tell("bob's registry mounts alice's live connection");
			return thrown(() => engine.clients.bob.registry.mount(engine.clients.alice.api[LiveConnection].connection));
		},
		dispose: (person: Person) => {
			story.tell(`${person}'s registry is disposed`);
			return untilSubscriptionsChange(engine, () => engine.clients[person].registry.dispose());
		},
		pauseThroughOtherBinding: (person: Person) => {
			story.tell(`${person} pauses live reads through their other binding of the same client`);
			const client = engine.clients[person];
			client.registry.set(client.otherBinding[LiveConnection].paused, true);
		},
		readInBobsRegistry: () => {
			story.tell("bob's registry reads alice's preferences");
			return thrown(() => engine.clients.bob.registry.get(engine.clients.alice.api.self.query(undefined)));
		},
		resync: () => {
			story.tell("the server resyncs every live stream");
			mark(engine);
			return Effect.asVoid(engine.server.resync);
		},
		runKeptSaveAgain: () => {
			story.tell("alice runs her kept save effect again");
			mark(engine);
			return engine.kept.effect ?? Effect.die(new Error("Keep a save effect before running it again"));
		},
		save: (person: Person, title: string, runtime: Person = person) => {
			story.tell(`${person} saves ${JSON.stringify(title)} as their preferences${runtime === person ? "" : ` through ${runtime}'s runtime`}`);
			mark(engine);
			return answered(saveOf(engine, person, title, runtime), () => "saved");
		},
		shown: (person: Person, view: PreferenceView) => shownOf(engine, person, view),
		status: (person: Person) =>
			Effect.sync(() => {
				const { needsResync, pending } = engine.clients[person].registry.get(engine.clients[person].api[LiveConnection].status);
				return { needsResync, pending };
			}),
		stored: (person: Person) => Effect.sync(() => engine.stored.get(person)),
		subscriptions: (person: Person) =>
			Effect.map(SubscriptionRef.get(engine.subscriptions), (all) =>
				all.filter((open) => open.person === person).flatMap((open) => open.queries.map(referenceWords)),
			),
		timesRead: (person: Person, view: PreferenceView) =>
			Effect.andThen(
				shownOf(engine, person, view),
				Effect.map(readsOf(engine, person, view), (count) => `read ${times(count)}`),
			),
		unmount: (person: Person, view: PreferenceView) => {
			story.tell(`${person} unmounts their ${view}`);
			return untilSubscriptionsChange(engine, () => engine.mounted.get(`${person} ${view}`)?.release());
		},
		unpauseThroughOtherBinding: (person: Person) => {
			story.tell(`${person} unpauses live reads through their other binding of the same client`);
			mark(engine);
			const client = engine.clients[person];
			client.registry.set(client.otherBinding[LiveConnection].paused, false);
		},
		untilPending: (person: Person) => {
			story.tell(`${person}'s live connection counts the change pending`);
			return untilPending(engine, person);
		},
		untilReRead: (person: Person, view: PreferenceView) =>
			Effect.gen(function* () {
				story.tell(`${person}'s ${view} are re-read and the new value reaches the view`);
				const client = engine.clients[person];
				const atom = client.view(view);
				yield* reRead(
					client.registry,
					atom,
					Stream.map(SubscriptionRef.changes(engine.reads), (reads) => countOf(reads, person, view)),
					engine.marked.get(`${person} ${view}`),
				);
			}),
	}),
});

export function watching(person: Person, ...views: readonly PreferenceView[]) {
	return sessionStory.trait("views", `${person} watches their ${views.join(", ")}, each read once`, (engine) => watch(engine, person, views));
}

export function pausedWithChangeHeld() {
	return sessionStory.trait(
		"after",
		"alice paused live reads through her other binding, and her announced change to Written while paused is pending",
		(engine) =>
			Effect.gen(function* () {
				const alice = engine.clients.alice;
				alice.registry.set(alice.otherBinding[LiveConnection].paused, true);
				engine.stored.set("alice", "Written while paused");
				yield* engine.announce("alice");
				yield* untilPending(engine, "alice");
			}),
	);
}

export function keptSave(title: string) {
	return sessionStory.trait("after", `alice saved ${title} with a save effect she keeps`, (engine) =>
		Effect.gen(function* () {
			const save = saveOf(engine, "alice", title);
			engine.kept.effect = Effect.asVoid(save);
			yield* save;
			yield* shownOf(engine, "alice", "preferences");
		}),
	);
}
