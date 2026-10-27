import { Effect, Path } from "effect";
import { childFolders, packageFolders } from "./areaFolders.ts";
import { nearestArea } from "./nearestArea.ts";

export const areaSuggestion = Effect.fn("WorkBoard.areaSuggestion")(function* (repository: string, area: string) {
	const path = yield* Path.Path;
	const segments = area.split("/");
	const bases = yield* packageFolders(repository);
	const first = nearestArea(segments[0] ?? "", [...bases.keys()]);
	let suggestion = first;
	let parent = first === undefined ? undefined : bases.get(first);
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
