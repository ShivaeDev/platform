import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import { markdownBoard } from "#board/markdown.ts";

export const boardReads = Effect.fn("BoardTest.boardReads")(function* (count: number) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = yield* fs.makeTempDirectoryScoped({ prefix: "fleet-reads-" });
	const reads = new Map<string, number>();
	let scans = 0;
	const tracked: FileSystem.FileSystem = {
		...fs,
		readDirectory: (folder) =>
			Effect.sync(() => {
				scans += 1;
			}).pipe(Effect.andThen(fs.readDirectory(folder))),
		readFileString: (file, options) =>
			Effect.sync(() => {
				reads.set(file, (reads.get(file) ?? 0) + 1);
			}).pipe(Effect.andThen(fs.readFileString(file, options))),
	};
	function source(id: string, approved = true, body = "Useful work.") {
		return `---\nid: ${id}\nkind: task\nfleet: ${approved ? "approved" : "draft"}\n---\n# ${id}\n\n${body}\n`;
	}
	function write(file: string, content: string) {
		return fs.writeFileString(path.join(root, file), content);
	}
	for (let index = 0; index < count; index += 1) {
		yield* write(`${index}.md`, source(`item.${index}`));
	}
	const services = Layer.mergeAll(Layer.succeed(FileSystem.FileSystem)(tracked), Layer.succeed(Path.Path)(path));
	return {
		board: markdownBoard(root).pipe(Layer.provide(services)),
		reads,
		remove: (file: string) => fs.remove(path.join(root, file)),
		root,
		scans: () => scans,
		services,
		source,
		write,
	};
}, Effect.provide(NodeServices.layer));
