import { Effect, Ref } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { answered, shown } from "#test/answers.ts";
import { markQuery, reRead } from "#test/reRead.ts";
import { settled } from "#test/settled.ts";
import { wireEngine } from "#test/wireEngine.ts";
import { TitleTaken } from "#test/wireNotesModel.ts";

interface ReceivedNote {
	readonly createdAt: unknown;
	readonly id: number;
	readonly title: string;
}

function described({ createdAt, id, title }: ReceivedNote) {
	const time = createdAt instanceof Date ? `${createdAt.toISOString()} as a Date` : `${JSON.stringify(createdAt)}, not a Date`;
	return `note ${id} ${title} created at ${time}`;
}

function rejected(taken: unknown) {
	return taken instanceof TitleTaken
		? `rejected with its TitleTaken class on ${taken.field}: ${taken.message}`
		: "rejected with an object tagged TitleTaken, not its class";
}

export const wireStory = storyKit({
	clock: "test",
	create: () => wireEngine,
	inspect: ({ stored }) => ({ stored: Effect.runSync(Ref.get(stored)) }),
	name: "a defined module served with its wire and called through its client contract",
	stages: ["clock", "notes", "views"],
	verbs: (engine, story) => {
		const list = engine.api.list.query(undefined);
		return {
			create: (title: string) => {
				story.tell(`alice's browser creates a note titled ${title} through the client contract over HTTP RPC`);
				const mark = engine.registry.getNodes().has(list) ? markQuery(engine.registry, list) : undefined;
				return answered(
					engine.run(engine.api.create.run({ title })).pipe(
						Effect.tap(() => (mark === undefined ? Effect.void : reRead(engine.registry, list, mark))),
						Effect.map(described),
						Effect.catchTag("TitleTaken", (taken) => Effect.succeed(rejected(taken))),
					),
					(answer) => answer,
				);
			},
			listShown: () => Effect.map(settled(engine.registry, list), (result) => shown(result, (notes) => notes.map(described))),
			storedCreation: () =>
				Effect.map(Ref.get(engine.stored), (notes) => notes.map((note) => `note ${note.id} stored at ${note.createdAt.toISOString()}`)),
		};
	},
});

export function clockReads(iso: string) {
	return wireStory.trait("clock", `the server's clock reads ${iso}`, () => TestClock.setTime(Date.parse(iso)));
}

export function noteStored(title: string) {
	return wireStory.trait("notes", `the store holds alice's note titled ${title}`, (engine) =>
		Ref.update(engine.stored, (notes) => [...notes, { createdAt: new Date(0), id: notes.length + 1, owner: engine.viewer, title }]),
	);
}

export function watchingList() {
	return wireStory.trait("views", "alice's browser shows her notes list, read once", (engine) => {
		const list = engine.api.list.query(undefined);
		engine.registry.mount(list);
		return settled(engine.registry, list);
	});
}
