import { Effect, Option, Stream } from "effect";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type HintViewer, heard, watchHints } from "#testing.ts";
import { answered, hintWords } from "./answers.ts";
import { documents } from "./policyServicesContract.ts";
import { type Person, policyServicesEngine } from "./policyServicesEngine.ts";

export const policyServicesStory = storyKit({
	clock: "live",
	*create() {
		const engine = yield* policyServicesEngine;
		return { ...engine, listeners: new Map<Person, HintViewer<unknown>>() };
	},
	name: "provider-account read policies",
	stages: ["listeners"],
	verbs: (engine, story) => ({
		announce: () => {
			story.tell("the server announces a change to the team's document");
			return engine.reactivity.invalidate(invalidationKeys([documents.item("team")]));
		},
		firstComparedValue: (person: Person) => {
			story.tell(`${person} subscribes to compared results of the team's document over WebSocket`);
			return answered(
				Effect.flatMap(engine.open(person, "socket"), (client) =>
					Stream.runHead(client("documents.$changes", { queries: [{ payload: { account: "team" }, query: "compare" }] })),
				),
				(update) =>
					Option.match(update, {
						onNone: () => "ended without a result",
						onSome: (value) => (value._tag === "Result" ? String(value.value) : hintWords(value)),
					}),
			);
		},
		firstHint: (person: Person) => {
			story.tell(`${person} subscribes to the team's document over WebSocket`);
			return answered(
				Effect.flatMap(engine.open(person, "socket"), (client) =>
					Stream.runHead(client("documents.$changes", { queries: [{ payload: { account: "team" }, query: "get" }] })),
				),
				(hint) =>
					Option.match(hint, {
						onNone: () => "ended without a hint",
						onSome: (update) => (update._tag === "Result" ? String(update.value) : hintWords(update)),
					}),
			);
		},
		heardChange: (person: Person) => {
			const listener = engine.listeners.get(person);
			return listener === undefined ? Effect.die(`${person} is not listening`) : heard(listener, [documents.item("team")]);
		},
		read: (person: Person) => {
			story.tell(`${person} reads the team's document over HTTP RPC`);
			return answered(
				Effect.flatMap(engine.open(person, "http"), (client) => client("documents.get", { account: "team" })),
				(value) => value,
			);
		},
		revoke: () => {
			story.tell("the team's provider account loses read access");
			return Effect.sync(() => engine.admitted.delete("team"));
		},
		subscriptionEnd: (person: Person) => {
			const listener = engine.listeners.get(person);
			return listener === undefined ? Effect.die(`${person} is not listening`) : answered(listener.finished, () => "completed");
		},
	}),
});

export const listening = policyServicesStory.trait("listeners", "alice has heard the first hint for the team's document", (engine) =>
	Effect.gen(function* () {
		const client = yield* engine.open("alice", "socket");
		engine.listeners.set(
			"alice",
			yield* watchHints(
				client("documents.$changes", { queries: [{ payload: { account: "team" }, query: "get" }] }).pipe(
					Stream.filter((update) => update._tag !== "Result"),
				),
			),
		);
	}),
);
