import { join } from "node:path";
import { Option } from "effect";
import type { FleetStoryState } from "#test/fleetStoryState.ts";

export function boardItemVerbs(engine: FleetStoryState, story: { readonly tell: (message: string) => void }) {
	function file(id: string) {
		return join(Option.getOrThrow(engine.boardRoot), `${id}.md`);
	}
	return {
		deleteBoardItem: (id: string) => {
			story.tell(`the Board item ${id} is deleted`);
			return engine.fs.remove(file(id));
		},
		duplicateBoardItem: (id: string) => {
			story.tell(`another Board item duplicates ${id}`);
			return engine.fs.copyFile(file(id), file(`${id}-duplicate`));
		},
	};
}
