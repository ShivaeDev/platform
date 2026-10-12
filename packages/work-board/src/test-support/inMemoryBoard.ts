import { Context, Effect, FileSystem, Layer, Option, Path, PubSub, Ref } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { readDocument } from "#server/document/read.ts";
import type { Change, Changes } from "#server/files/changes.ts";
import { HandoffsService } from "#server/handoffs/Service.ts";
import { page } from "#server/http/page.ts";
import { metadataModel } from "#server/metadata/model.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { ResponseConfig, Responses } from "#server/responses/service.ts";
import { handlers } from "#server/rpc/handlers.ts";
import { entriesOf } from "#server/search/entries.ts";
import { metadataEntries } from "#server/search/metadataEntries.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

export function inMemoryBoard(files: Readonly<Record<string, string>>) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const documents = Object.entries(files).map(([file, source]) => ({ file, parsed: metadataParse(source) }));
			const home = documents[0]?.file;
			const model = metadataModel(documents, [], home);
			const entries = yield* Effect.promise(() =>
				Promise.all(documents.map(({ file, parsed }) => entriesOf(parsed.body, file, file === home, parsed.bodyLine))),
			);
			const snapshot: Snapshot = {
				documents,
				entries: metadataEntries(entries.flat(), documents, model),
				model,
				modified: new Map(),
				revision: 0,
				unavailable: [],
			};
			const changes: Changes = {
				events: yield* Effect.acquireRelease(PubSub.unbounded<Change>(), PubSub.shutdown),
				files: Effect.succeed(documents.map(({ file }) => ({ modified: 0, path: file }))),
				realRoot: "/board",
				revision: Effect.succeed(0),
				watching: yield* Ref.make(false),
			};
			const options = { changes, enabled: false, index: Effect.succeed(snapshot), root: "/board" };
			const services = yield* Layer.build(
				Layer.merge(Responses.layer, HandoffsService.layer).pipe(Layer.provide(Layer.succeed(ResponseConfig, options))),
			);
			const context = Context.merge(yield* Effect.context<Highlighter | FileSystem.FileSystem | Path.Path>(), services);
			return yield* handlers({
				...options,
				document: (url) => readDocument({ ...options, home, writable: false })(url).pipe(Effect.provideContext(context)),
				home,
				page: (url) =>
					page(
						{ home, root: "/board" },
						changes,
						options.index,
					)(HttpServerRequest.fromWeb(new Request(`http://127.0.0.1${url}`))).pipe(Effect.provideContext(context)),
			}).pipe(Effect.provideContext(context));
		}),
	).pipe(
		Layer.provide([
			FileSystem.layerNoop({
				readFileString: (path) => Effect.succeed(files[path.slice("/board/".length)] ?? ""),
				realPath: (path) => Effect.succeed(path),
				stat: () =>
					Effect.succeed({
						atime: Option.none(),
						birthtime: Option.none(),
						blksize: Option.none(),
						blocks: Option.none(),
						dev: 0,
						gid: Option.none(),
						ino: Option.none(),
						mode: 0,
						mtime: Option.none(),
						nlink: Option.none(),
						rdev: Option.none(),
						size: FileSystem.Size(0),
						type: "Directory",
						uid: Option.none(),
					}),
			}),
			Path.layer,
			Highlighter.layer,
		]),
	);
}
