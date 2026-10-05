import { Effect, FileSystem, Option, Path, Ref, Semaphore } from "effect";
import type { Changes } from "#files/changes.ts";
import { within } from "#files/list.ts";
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
		const path = yield* Path.Path;
		const files = yield* changes.files;
		const entries: Entry[] = [];
		const documents: MetadataDocument[] = [];
		const unavailable: string[] = [];
		for (const file of files) {
			const found = yield* Effect.option(
				Effect.gen(function* () {
					const real = yield* fs.realPath(path.join(root, file.path));
					if (!within(changes.realRoot, path.sep, real)) {
						return undefined;
					}
					const source = yield* fs.readFileString(real);
					const parsed = metadataParse(source);
					const rendered = yield* Effect.tryPromise(() => entriesOf(parsed.body, file.path, file.path === home, parsed.bodyLine));
					return { parsed, rendered };
				}),
			);
			if (Option.isSome(found) && found.value) {
				documents.push({ file: file.path, parsed: found.value.parsed });
				entries.push(...found.value.rendered);
			} else {
				unavailable.push(file.path);
			}
		}
		const model = metadataModel(documents, unavailable);
		const enriched = metadataEntries(entries, documents, model);
		const snapshot = { documents, entries: enriched, model, revision, unavailable };
		yield* Ref.set(cached, unavailable.length > 0 ? undefined : snapshot);
		return snapshot;
	});
	return semaphore.withPermit(read);
});
