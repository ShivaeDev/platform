import { renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, PubSub } from "effect";
import type { ParsedMetadata } from "#integration/metadata.ts";
import type { Change } from "#server/files/changes.ts";
import { watchChanges } from "#server/files/changes.ts";
import { searchSnapshot } from "#server/search/snapshot.ts";
import { folder } from "./board.ts";

const COUNT = 2000;
const waitForChange = Effect.fn("Benchmark.waitForChange")(function* (subscription: PubSub.Subscription<Change>, paths: readonly string[]) {
	for (;;) {
		const event = yield* PubSub.take(subscription);
		const announced = event._tag === "Changed" ? event.paths : [];
		if (paths.every((path) => announced.includes(path))) {
			return;
		}
	}
});
function source(index: number, revision = 0) {
	return `---\nid: item.${index}\nkind: task\nstatus: draft\nowner: claude\ncriteria:\n - id: done\n   text: Verify item ${index}\nrelationships:\n - kind: depends_on\n   target: item.${(index + 1) % COUNT}#done\n---\n# Item ${index}\n\nRevision ${revision}. Read [the next item](item-${(index + 1) % COUNT}.md).\n`;
}
const notes = folder(Object.fromEntries(Array.from({ length: COUNT }, (_, index) => [`item-${index}.md`, source(index)])));
let reads = 0;
const services = Layer.effect(
	FileSystem.FileSystem,
	Effect.map(Effect.service(FileSystem.FileSystem), (fs) => ({
		...fs,
		readFileString: (path, encoding) =>
			Effect.suspend(() => {
				reads += 1;
				return fs.readFileString(path, encoding);
			}),
	})),
).pipe(Layer.provideMerge(NodeServices.layer));

try {
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const changes = yield* watchChanges(notes.root);
				const subscription = yield* PubSub.subscribe(changes.events);
				const index = yield* searchSnapshot(notes.root, undefined, changes);
				let previous = new Map<string, ParsedMetadata>();
				function measure(operation: string) {
					return Effect.gen(function* () {
						reads = 0;
						const start = performance.now();
						const snapshot = yield* index;
						const elapsed = performance.now() - start;
						const parsed = snapshot.documents.filter((document) => previous.get(document.file) !== document.parsed).length;
						previous = new Map(snapshot.documents.map((document) => [document.file, document.parsed]));
						yield* Effect.logInfo(JSON.stringify({ filesParsed: parsed, filesRead: reads, milliseconds: Number(elapsed.toFixed(2)), operation }));
					});
				}
				function change(operation: string, paths: readonly string[], mutate: () => void) {
					return Effect.gen(function* () {
						mutate();
						yield* waitForChange(subscription, paths);
						yield* measure(operation);
					});
				}
				yield* measure("cold");
				yield* change("edit", ["item-0.md"], () => notes.write("item-0.md", source(0, 1)));
				yield* change("add", ["added.md"], () => notes.write("added.md", source(COUNT)));
				yield* change("delete", ["added.md"], () => unlinkSync(join(notes.root, "added.md")));
				yield* change("rename", ["item-0.md", "renamed.md"], () => renameSync(join(notes.root, "item-0.md"), join(notes.root, "renamed.md")));
			}),
		).pipe(Effect.provide(services)),
	);
} finally {
	notes.remove();
}
