import { Effect, Option, Ref, Semaphore } from "effect";
import type { Changes } from "#files/changes.ts";
import { invalidationsSince } from "#files/invalidations.ts";
import type { MarkdownFile } from "#files/list.ts";
import type { MetadataDocument, metadataModel } from "#metadata/model.ts";
import { updateModel } from "#metadata/updateModel.ts";
import type { Entry } from "./entries.ts";
import { type IndexedDocument, readDocument } from "./readDocument.ts";
import { updateEntries } from "./updateEntries.ts";

export interface Snapshot {
	readonly documents: readonly MetadataDocument[];
	readonly entries: readonly Entry[];
	readonly model: ReturnType<typeof metadataModel>;
	readonly revision: number;
	readonly unavailable: readonly string[];
}

function shouldRead(
	file: MarkdownFile,
	previous: IndexedDocument | undefined,
	listed: ReadonlyMap<string, MarkdownFile>,
	dirty: ReadonlySet<string> | undefined,
) {
	return (
		!previous
		|| dirty === undefined
		|| listed.get(file.path)?.modified !== file.modified
		|| [...dirty].some((path) => path === file.path || file.path.startsWith(`${path}/`))
	);
}

export const searchSnapshot = Effect.fn("WorkBoard.searchSnapshot")(function* (root: string, home: string | undefined, changes: Changes) {
	const cached = yield* Ref.make<Snapshot | undefined>(undefined);
	const semaphore = yield* Semaphore.make(1);
	let records = new Map<string, IndexedDocument>();
	let listed = new Map<string, MarkdownFile>();
	const enrich = updateEntries();
	function find(file: MarkdownFile, dirty: ReadonlySet<string> | undefined) {
		const previous = records.get(file.path);
		return shouldRead(file, previous, listed, dirty)
			? Effect.map(Effect.option(readDocument(root, changes.realRoot, file.path, home, file.modified, previous)), Option.getOrUndefined)
			: Effect.succeed(previous);
	}
	const read = Effect.gen(function* () {
		const files = yield* changes.files;
		const revision = yield* changes.revision;
		const hit = yield* Ref.get(cached);
		const watching = yield* Ref.get(changes.watching);
		if (hit?.revision === revision && hit.unavailable.length === 0 && watching) {
			return hit;
		}
		const dirty = hit && watching ? invalidationsSince(changes, hit.revision) : undefined;
		const next = new Map<string, IndexedDocument>();
		const documents: MetadataDocument[] = [];
		const unavailable: string[] = [];
		for (const file of files) {
			const found = yield* find(file, dirty);
			if (found) {
				documents.push(found.document);
				next.set(file.path, found);
			} else {
				unavailable.push(file.path);
			}
		}
		const model = updateModel(hit?.model, documents, unavailable, home ?? files[0]?.path);
		const enriched = enrich(next, model);
		const snapshot = { documents, entries: enriched, model, revision, unavailable };
		records = next;
		listed = new Map(files.map((file) => [file.path, file]));
		yield* Ref.set(cached, snapshot);
		return snapshot;
	});
	return semaphore.withPermit(read);
});
