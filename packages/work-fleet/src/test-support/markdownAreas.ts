import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Layer, Option } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import { fleetStory } from "#test/fleetStory.ts";

export const markdownAreas = fleetStory.trait("configuration", "approved Markdown Board items share an area", function* (engine) {
	const root = yield* engine.fs.makeTempDirectoryScoped({ prefix: "fleet-area-board-" });
	for (const id of ["one", "two", "three"]) {
		yield* engine.fs.writeFileString(join(root, `${id}.md`), `---\nid: ${id}\nkind: task\nfleet: approved\nareas: [shared]\n---\n# Work ${id}\n`);
	}
	engine.boardRoot = Option.some(root);
	engine.board = Option.some(markdownBoard(root).pipe(Layer.provide(NodeServices.layer)));
});
