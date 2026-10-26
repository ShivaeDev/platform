import { postgres } from "#test/sqlStory.ts";
import { crossTableReads } from "./reads.ts";

export function hasDashboardRows() {
	return postgres.trait("schema", "pull requests and reports belong to separate repositories", function* (engine) {
		engine.crossTableReads.set(yield* crossTableReads);
	});
}
