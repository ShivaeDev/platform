import { Effect, FileSystem } from "effect";
import { markdownPath } from "#files/markdownPath.ts";
import type { MetadataDocument } from "#metadata/model.ts";
import { metadataParse } from "#metadata/parse.ts";
import { type Entry, entriesOf } from "./entries.ts";

export interface IndexedDocument {
	readonly document: MetadataDocument;
	readonly entries: readonly Entry[];
	readonly source: string;
}

export const readDocument = Effect.fn("WorkBoard.readDocument")(function* (
	root: string,
	realRoot: string,
	file: string,
	home: string | undefined,
	previous?: IndexedDocument,
) {
	const fs = yield* FileSystem.FileSystem;
	const real = yield* markdownPath(root, realRoot, file);
	if (real === undefined) {
		return undefined;
	}
	const source = yield* fs.readFileString(real);
	if (previous?.source === source) {
		return previous;
	}
	const parsed = metadataParse(source);
	const links = new Set<string>();
	const entries = yield* Effect.tryPromise(() => entriesOf(parsed.body, file, file === home, parsed.bodyLine, links));
	return { document: { file, links: [...links], parsed }, entries, source };
});
