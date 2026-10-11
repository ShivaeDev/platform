import { Effect, FileSystem, Layer, Path, PubSub, Ref } from "effect";
import type { Change, Changes } from "#files/changes.ts";
import { HandoffsService } from "#handoffs/Service.ts";
import { metadataModel } from "#metadata/model.ts";
import { metadataParse } from "#metadata/parse.ts";
import { ResponseConfig, Responses } from "#responses/service.ts";
import { ReadFailed } from "#rpc/contract.ts";
import { handlers } from "#rpc/handlers.ts";
import { entriesOf } from "#search/entries.ts";
import { metadataEntries } from "#search/metadataEntries.ts";
import type { Snapshot } from "#search/snapshot.ts";

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
			return yield* handlers({
				...options,
				home,
				page: () => Effect.fail(new ReadFailed({ operation: "page", status: 404 })),
			}).pipe(Effect.provide(Layer.merge(Responses.layer, HandoffsService.layer).pipe(Layer.provide(Layer.succeed(ResponseConfig, options)))));
		}),
	).pipe(Layer.provide([FileSystem.layerNoop({}), Path.layer]));
}
