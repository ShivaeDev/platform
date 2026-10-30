import { Clock, Effect, type FileSystem, Option, type Path, type PlatformError, Ref, Semaphore, SubscriptionRef } from "effect";
import type { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import type { Indexing } from "#rpc/Indexing.ts";
import { archiveDocuments, refreshArchived } from "#server/archive/documents.ts";
import { loadSettled } from "#server/archive/loadSettled.ts";
import { archiveSettled } from "#server/archive/settled.ts";
import type { Changes } from "#server/files/changes.ts";
import { invalidationsSince } from "#server/files/invalidations.ts";
import type { MarkdownFile } from "#server/files/list.ts";
import { markdownPaths } from "#server/files/markdownPath.ts";
import type { MetadataDocument, metadataModel } from "#server/metadata/model.ts";
import { updateModel } from "#server/metadata/updateModel.ts";
import type { Entry } from "./entries.ts";
import { fileCounter } from "./fileCounter.ts";
import { type IndexedDocument, readDocument } from "./readDocument.ts";
import { updateEntries } from "./updateEntries.ts";

const READ_CONCURRENCY = 16;

function currentSnapshot(hit: Snapshot | undefined, revision: number, watching: boolean, elapsed: number) {
	return hit?.revision === revision && hit.unavailable.length === 0 && watching && elapsed < 60 * 60 * 1000 ? hit : undefined;
}

export interface Snapshot {
	readonly archived?: (selection: string) => Effect.Effect<Snapshot, PlatformError.PlatformError | InternalServerError>;
	readonly documents: readonly MetadataDocument[];
	readonly entries: readonly Entry[];
	readonly maintainer?: string;
	readonly model: ReturnType<typeof metadataModel>;
	readonly modified: ReadonlyMap<string, number>;
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

const settledListing = Effect.fn("WorkBoard.settledListing")(function* (changes: Changes) {
	let revision = yield* changes.revision;
	let files = yield* changes.files;
	while ((yield* changes.revision) !== revision) {
		revision = yield* changes.revision;
		files = yield* changes.files;
	}
	return { files, revision };
});

export const searchSnapshot = Effect.fn("WorkBoard.searchSnapshot")(function* (
	root: string,
	home: string | undefined,
	changes: Changes,
	maintainer = "maintainer",
	indexing?: SubscriptionRef.SubscriptionRef<Indexing | undefined>,
) {
	const cached = yield* Ref.make<Snapshot | undefined>(undefined);
	const semaphore = yield* Semaphore.make(1);
	let housekeptAt = 0;
	let records = new Map<string, IndexedDocument>();
	let listed = new Map<string, MarkdownFile>();
	const enrich = updateEntries();
	function find(file: MarkdownFile, dirty: ReadonlySet<string> | undefined, resolve: (file: string) => Effect.Effect<string | undefined>) {
		const previous = records.get(file.path);
		return shouldRead(file, previous, listed, dirty)
			? Effect.map(Effect.option(readDocument(root, changes.realRoot, file.path, home, file.modified, previous, resolve)), Option.getOrUndefined)
			: Effect.succeed(previous);
	}
	function report(progress: Indexing | undefined) {
		return indexing ? SubscriptionRef.set(indexing, progress) : Effect.void;
	}
	const buildSnapshot = Effect.fn("WorkBoard.buildSnapshot")(function* (
		hit: Snapshot | undefined,
	): Effect.fn.Return<Snapshot, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> {
		const now = yield* Clock.currentTimeMillis;
		// Only a build without a previous snapshot reads the whole workspace; later builds reread the files that changed.
		const progress = hit === undefined ? report : () => Effect.void;
		yield* progress({ _tag: "Indexing", read: 0 });
		const { files, revision } = yield* settledListing(changes);
		const watching = yield* Ref.get(changes.watching);
		const current = currentSnapshot(hit, revision, watching, now - housekeptAt);
		if (current) {
			return current;
		}
		const dirty = hit && watching ? invalidationsSince(changes, hit.revision) : undefined;
		const next = new Map<string, IndexedDocument>();
		const documents: MetadataDocument[] = [];
		const unavailable: string[] = [];
		yield* progress({ _tag: "Indexing", read: 0, total: files.length });
		const counted = fileCounter(files.length, progress);
		const resolve = yield* markdownPaths(changes.realRoot);
		const indexed = yield* Effect.forEach(files, (file) => Effect.tap(find(file, dirty, resolve), counted), { concurrency: READ_CONCURRENCY });
		for (const [position, file] of files.entries()) {
			const found = indexed[position];
			if (found) {
				documents.push(found.document);
				next.set(file.path, found);
			} else {
				unavailable.push(file.path);
			}
		}
		const modified = new Map(files.map((file) => [file.path, file.modified]));
		const moved = yield* archiveDocuments(
			root,
			documents.map((document) => ({ ...document, modified: modified.get(document.file) ?? now })),
			now,
		);
		moved.push(...(yield* archiveSettled(root, documents)));
		housekeptAt = now;
		if (moved.length > 0) {
			yield* refreshArchived(changes, moved);
			return yield* buildSnapshot(hit);
		}
		const model = updateModel(hit?.model, documents, unavailable, home ?? files[0]?.path);
		const enriched = enrich(next, model);
		const services = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
		const snapshot: Snapshot = {
			archived: (selection) => loadSettled(root, snapshot, selection).pipe(Effect.provideContext(services)),
			documents,
			entries: enriched,
			maintainer,
			model,
			modified,
			revision,
			unavailable,
		};
		records = next;
		listed = new Map(files.map((file) => [file.path, file]));
		yield* Ref.set(cached, snapshot);
		return snapshot;
	});
	return semaphore.withPermit(
		Effect.flatMap(Ref.get(cached), (hit) => (hit === undefined ? Effect.ensuring(buildSnapshot(hit), report(undefined)) : buildSnapshot(hit))),
	);
});
