import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { FileSystem, Layer } from "effect";
import { engine } from "#test/engineStory.ts";
import { liveBoard } from "#test/liveBoard.ts";

export const markdownAreas = engine.trait("configuration", "approved Markdown Board items share an area", function* (state) {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.makeTempDirectoryScoped({ prefix: "fleet-area-board-" });
	yield* fs.makeDirectory(join(root, "shared"));
	for (const id of ["one", "two", "three"]) {
		yield* fs.writeFileString(join(root, `${id}.md`), `---\nid: ${id}\nkind: task\nfleet: approved\nareas: [shared]\n---\n# Work ${id}\n`);
	}
	state.root = root;
	state.board = liveBoard(root).pipe(Layer.provide(NodeServices.layer));
});
