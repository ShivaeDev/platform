import { Effect, PubSub, Ref, Stream } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import type { Change, Changes } from "#files/changes.ts";
import { metadataModel } from "#metadata/model.ts";
import { metadataParse } from "#metadata/parse.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { hints } from "./hints.ts";

it.live(
	"sends an initial reconciliation, targeted contiguous hints, and a full reconciliation after server-local delivery loss or watcher uncertainty",
	function* () {
		const seen = yield* Effect.scoped(
			Effect.gen(function* () {
				const events = yield* PubSub.unbounded<Change>();
				const watching = yield* Ref.make(true);
				const document = { file: "note.md", parsed: metadataParse("Note") };
				const model = metadataModel([document]);
				const snapshot: Snapshot = { documents: [document], entries: [], model, modified: new Map(), revision: 0, unavailable: [] };
				const changes: Changes = {
					events,
					files: Effect.succeed([]),
					realRoot: "/notes",
					revision: Effect.succeed(0),
					sequence: Effect.succeed(0),
					watching,
				};
				const output: string[] = [];
				const record = Effect.fn("Test.record")(function* (hint: { readonly _tag: string }) {
					output.push(hint._tag);
					if (output.length === 1) {
						yield* PubSub.publish(events, { _tag: "Changed", paths: ["note.md"], sequence: 1 });
					}
					if (output.length === 2) {
						yield* PubSub.publish(events, { _tag: "Changed", paths: ["note.md"], sequence: 3 });
					}
					if (output.length === 3) {
						yield* PubSub.publish(events, { _tag: "Watching", sequence: 4, watching: false });
					}
				});
				yield* hints(changes, Effect.succeed(snapshot)).pipe(Stream.take(4), Stream.runForEach(record));
				return output;
			}),
		);
		expect(seen).toEqual(["Resync", "Changed", "Resync", "Resync"]);
	},
);
