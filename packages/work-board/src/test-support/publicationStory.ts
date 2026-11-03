import "#test/adapters/publicationFaults.ts";
import { readdirSync, readFileSync } from "node:fs";
import { Effect, Fiber } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { PublicationFailure } from "#server/PublicationFailure.ts";
import { Publication, publishOnce, replaceIfUnchanged } from "#server/publication.ts";
import { duringTemporaryWrite, pausedTemporaryWrite } from "#test/adapters/publicationFaults.ts";
import { type Folder, folder } from "./board.ts";
import { entriesOf, textOf } from "./publicationFaults.ts";
import { settledEffect } from "./responseOutcome.ts";

interface PublicationEngine {
	notes: Folder;
	pending?: Fiber.Fiber<void, PublicationFailure>;
	staged?: Promise<void>;
}

export const publicationStory = storyKit({
	clock: "live",
	*create() {
		const notes = folder({});
		yield* Effect.addFinalizer(() => Effect.sync(notes.remove));
		const engine: PublicationEngine = { notes };
		return engine;
	},
	inspect: ({ notes }) => ({ files: entriesOf(notes.root) }),
	name: "publication",
	stages: ["disk"],
	verbs: (engine, story) => {
		const { notes } = engine;
		function publication(path: string, content: string | Uint8Array, expectedSource?: string) {
			const input = { content, path, realRoot: notes.root, root: notes.root };
			return (expectedSource === undefined ? publishOnce(input) : replaceIfUnchanged({ ...input, expectedSource })).pipe(
				Effect.provide(Publication.layer),
			);
		}
		return {
			bytes: (path: string) => {
				story.tell(`the reader reads the bytes of ${path}`);
				return Effect.sync(() => [...readFileSync(`${notes.root}/${path}`)]);
			},
			edit: (path: string, content: string) => {
				story.tell(`an outside editor writes ${path}`);
				return Effect.sync(() => notes.write(path, content));
			},
			entries: (path: string) => {
				story.tell(`the reader lists ${path}`);
				return Effect.sync(() => entriesOf(`${notes.root}/${path}`));
			},
			interrupt: () => {
				story.tell("the host interrupts the publication and waits for its scope to close");
				return engine.pending ? Fiber.interrupt(engine.pending).pipe(Effect.asVoid) : Effect.die("No publication is in flight");
			},
			publish: (path: string, content: string | Uint8Array) => {
				story.tell(`the writer publishes ${path} once`);
				return settledEffect(publication(path, content).pipe(Effect.as("published")));
			},
			replace: (path: string, expectedSource: string, content: string) => {
				story.tell(`the writer replaces ${path} only if its source is unchanged`);
				return settledEffect(publication(path, content, expectedSource).pipe(Effect.as("replaced")));
			},
			stagedTexts: (path: string) => {
				story.tell(`the reader reads the staged files in ${path}`);
				return Effect.sync(() =>
					readdirSync(`${notes.root}/${path}`)
						.filter((name) => name.endsWith(".tmp"))
						.map((name) => readFileSync(`${notes.root}/${path}/${name}`, "utf8")),
				);
			},
			startPublication: Effect.fnUntraced(function* (path: string, content: string, expectedSource?: string) {
				story.tell(`the writer starts publishing ${path}`);
				engine.pending = yield* Effect.forkChild(publication(path, content, expectedSource));
				if (!engine.staged) {
					return yield* Effect.die("No temporary write is paused");
				}
				yield* Effect.promise(() => engine.staged ?? Promise.resolve());
			}),
			text: (path: string) => {
				story.tell(`the reader reads ${path}`);
				return Effect.sync(() => textOf(`${notes.root}/${path}`));
			},
		};
	},
});

export const writePaused = publicationStory.trait("disk", "the native write pauses after writing part of the staged file", (engine) => {
	engine.staged = pausedTemporaryWrite();
});

export function sourceChangesDuringWrite(path: string, source: string) {
	return publicationStory.trait("disk", `an outside editor changes ${path} while the replacement is staged`, (engine) => {
		duringTemporaryWrite(() => engine.notes.write(path, source));
	});
}
