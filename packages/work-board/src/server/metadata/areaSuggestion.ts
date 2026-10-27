import { Effect, Path } from "effect";
import { type AreaFolder, childFolders } from "./areaFolders.ts";
import { nearestArea } from "./nearestArea.ts";

export const areaSuggestion = Effect.fn("WorkBoard.areaSuggestion")(function* (bases: ReadonlyMap<string, AreaFolder>, area: string) {
	const path = yield* Path.Path;
	const segments = area.split("/");
	const first = nearestArea(segments[0] ?? "", [...bases.keys()]);
	let suggestion = first;
	let parent = first === undefined ? undefined : bases.get(first)?.subfolders;
	for (const segment of segments.slice(1)) {
		if (parent === undefined) {
			break;
		}
		const next = nearestArea(segment, yield* childFolders(parent));
		if (next === undefined) {
			break;
		}
		suggestion = `${suggestion}/${next}`;
		parent = path.join(parent, next);
	}
	return suggestion;
});
