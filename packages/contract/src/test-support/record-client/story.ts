import { Effect, Option, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { isClientSettled } from "#clientActivity.ts";
import { untilReflected } from "#commandSignal.ts";
import { forSubject } from "#forSubject.ts";
import { type ContractsClient, makeClient } from "#makeClient.ts";
import { answered, shown } from "#test/answers.ts";
import { type RecordClientEngine, recordClientEngine } from "#test/record-client/engine.ts";
import { Shelf } from "#test/record-client/Shelf.ts";
import { settled } from "#test/settled.ts";

// A page's client names no URL, so the page's location decides where it connects; a Node story stands the location in.
function inPage(engine: RecordClientEngine, path: string) {
	return Effect.acquireRelease(
		Effect.sync(() => Reflect.set(globalThis, "location", { href: `${engine.origin}${path}` })),
		() => Effect.sync(() => Reflect.deleteProperty(globalThis, "location")),
	);
}

function reflected<A, E>(engine: RecordClientEngine, command: Effect.Effect<A, E, ContractsClient | Reactivity.Reactivity>) {
	return answered(
		AtomRegistry.getResult(engine.registry, engine.client.runtime.atom(untilReflected(command)).pipe(Atom.setIdleTTL(0))),
		() => "reflected",
	);
}

function serializationKey(atom: Atom.Atom<unknown>) {
	return Atom.isSerializable(atom) ? atom[Atom.SerializableTypeId].key : "not serializable";
}

function onClient<A, E>(engine: RecordClientEngine, effect: Effect.Effect<A, E, ContractsClient>) {
	return answered(AtomRegistry.getResult(engine.registry, engine.client.runtime.atom(effect).pipe(Atom.setIdleTTL(0))), String);
}

function forDana(engine: RecordClientEngine) {
	return forSubject(engine.client.api, "dana");
}

export const recordClientStory = storyKit({
	clock: "test",
	create: () => recordClientEngine,
	name: "one client made from a record of contracts over a real host socket",
	stages: ["views"],
	verbs: (engine, story) => ({
		activity: () => Effect.map(engine.activity.current, (state) => `${state.connectionStatus}, ${isClientSettled(state) ? "settled" : "pending"}`),
		boundJournal: (subject?: string) =>
			Effect.map(settled(engine.registry, forDana(engine).journal.entries.query(undefined, subject === undefined ? {} : { subject })), (result) =>
				shown(result, String),
			),
		boundOwner: () =>
			onClient(
				engine,
				Effect.map(
					Stream.runHead(forDana(engine).journal.owner.run(undefined)),
					Option.getOrElse(() => "nothing"),
				),
			),
		boundWrite: (entry: string) => {
			story.tell(`the coach writes ${entry} through the client bound to dana`);
			return reflected(engine, forDana(engine).journal.write.run({ entry }));
		},
		bump: () => {
			story.tell("the tab bumps the tally");
			return reflected(engine, engine.client.api.tally.bump.run());
		},
		count: () => Effect.sync(() => shown(engine.registry.get(engine.views.count), String)),
		identities: () =>
			Effect.sync(() => {
				const perCall = engine.client.api.journal.entries.query(undefined, { serializationKey: "journal", subject: "dana" });
				const bound = forDana(engine).journal.entries.query(undefined, { serializationKey: "journal" });
				return {
					"bound serialization key": serializationKey(bound),
					"per-call serialization key": serializationKey(perCall),
					"query atom": bound === perCall ? "shared" : "separate",
					"write run of a second binding":
						forSubject(engine.client.api.journal, "dana").write.run === forDana(engine).journal.write.run ? "same" : "new",
				};
			}),
		journal: (subject?: string) =>
			Effect.map(settled(engine.registry, engine.client.api.journal.entries.query(undefined, subject === undefined ? {} : { subject })), (result) =>
				shown(result, String),
			),
		shelve: (title: string) => {
			story.tell(`the tab shelves ${title}`);
			return reflected(engine, engine.client.api.shelf.shelve.run({ title }));
		},
		shownBoundJournal: () =>
			onClient(engine, engine.client.sync).pipe(
				Effect.andThen(Effect.sync(() => shown(engine.registry.get(forDana(engine).journal.entries.query()), String))),
			),
		titles: () => Effect.sync(() => shown(engine.registry.get(engine.views.titles), (titles) => titles.join(", "))),
		titlesInPage: (path: string) =>
			Effect.gen(function* () {
				story.tell(`a page at ${path} opens the shelf with a client that names no URL`);
				yield* inPage(engine, path);
				const page = makeClient({ shelf: Shelf }, engine.options);
				const result = yield* settled(engine.registry, page.api.shelf.titles.query());
				return shown(result, (titles) => titles.join(", "));
			}),
		watchesBoundJournal: () => {
			story.tell("the coach watches dana's journal live through the client bound to dana");
			engine.registry.mount(forDana(engine).journal.entries.query());
			return Effect.map(settled(engine.registry, forDana(engine).journal.entries.query()), (result) => shown(result, String));
		},
		write: (entry: string, subject?: string) => {
			story.tell(`the coach writes ${entry} in ${subject === undefined ? "a call that names no account" : `${subject}'s journal`}`);
			return reflected(engine, engine.client.api.journal.write.run({ entry }, subject === undefined ? {} : { subject }));
		},
		writtenElsewhere: (account: string, entry: string) => {
			story.tell(`${account} writes ${entry} in their journal from another tab`);
			return engine.writtenElsewhere(account, entry);
		},
	}),
});

export const watchingBoth = recordClientStory.trait("views", "the tab shows the shelf and the tally", function* (engine) {
	engine.registry.mount(engine.views.titles);
	engine.registry.mount(engine.views.count);
	yield* settled(engine.registry, engine.views.titles);
	yield* settled(engine.registry, engine.views.count);
});
