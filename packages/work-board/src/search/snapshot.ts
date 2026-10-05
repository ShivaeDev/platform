import { Effect, FileSystem, Option, Ref, Semaphore } from "effect";
import type { Changes } from "#files/changes.ts";
import { markdownPath } from "#files/markdownPath.ts";
import { type MetadataDocument, metadataModel } from "#metadata/model.ts";
import { metadataParse } from "#metadata/parse.ts";
import { type Entry, entriesOf } from "./entries.ts";
import { metadataEntries } from "./metadataEntries.ts";

export interface Snapshot {
	readonly documents: readonly MetadataDocument[];
	readonly entries: readonly Entry[];
	readonly model: ReturnType<typeof metadataModel>;
	readonly revision: number;
	readonly unavailable: readonly string[];
}

export const searchSnapshot = Effect.fn("WorkBoard.searchSnapshot")(function* (root: string, home: string | undefined, changes: Changes) {
	const cached = yield* Ref.make<Snapshot | undefined>(undefined);
	const semaphore = yield* Semaphore.make(1);
	const read = Effect.gen(function* () {
		const revision = yield* changes.revision;
		const hit = yield* Ref.get(cached);
		if (hit?.revision === revision && (yield* Ref.get(changes.watching))) {
			return hit;
		}
		const fs = yield* FileSystem.FileSystem;
		const files = yield* changes.files;
		const entries: Entry[] = [];
		const documents: MetadataDocument[] = [];
		const unavailable: string[] = [];
		for (const file of files) {
			const found = yield* Effect.option(
				Effect.gen(function* () {
					const real = yield* markdownPath(root, changes.realRoot, file.path);
					if (real === undefined) {
						return undefined;
					}
					const source = yield* fs.readFileString(real);
					const parsed = metadataParse(source);
					const links = new Set<string>();
					const rendered = yield* Effect.tryPromise(() => entriesOf(parsed.body, file.path, file.path === home, parsed.bodyLine, links));
					return { links: [...links], parsed, rendered };
				}),
			);
			if (Option.isSome(found) && found.value) {
				documents.push({ file: file.path, links: found.value.links, parsed: found.value.parsed });
				entries.push(...found.value.rendered);
			} else {
				unavailable.push(file.path);
			}
		}
		const model = metadataModel(documents, unavailable, home ?? files[0]?.path);
		const enriched = metadataEntries(entries, documents, model);
		const snapshot = { documents, entries: enriched, model, revision, unavailable };
		yield* Ref.set(cached, unavailable.length > 0 ? undefined : snapshot);
		return snapshot;
	});
	return semaphore.withPermit(read);
});
