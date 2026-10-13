import { Effect } from "effect";
import { STATUS_MARKER, statusMarkdown } from "#board/statusMarkdown.ts";
import { writePublished } from "#board/writePublished.ts";
import type { FleetRecord } from "#model.ts";
import { BoardFailure } from "#policy.ts";

export function writeStatus(root: string, realRoot: string, records: readonly FleetRecord[]) {
	return writePublished(root, realRoot, "status.md", statusMarkdown(records), (source) => source.startsWith(`${STATUS_MARKER}\n`)).pipe(
		Effect.mapError((error) => new BoardFailure({ message: error.message })),
	);
}
