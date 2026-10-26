import { Effect } from "effect";
import { Conflict } from "@shivaedev/contract/errors/taxonomy.ts";
import type { DraftInput, RecordedResponse } from "#browser/responses/schema.ts";
import type { ResponseRejection } from "#rpc/rejections.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import type { WorkspaceSettings } from "#server/workspace.ts";
import { publish } from "./publish.ts";
import { matchesResponse, responseMarkdown } from "./records.ts";

export const retryResponse = Effect.fn("WorkBoard.retryResponse")(function* (
	existing: RecordedResponse,
	input: DraftInput,
	snapshot: Effect.Effect<Snapshot, ResponseRejection>,
	options: WorkspaceSettings,
) {
	if (!matchesResponse(existing, input)) {
		return yield* Effect.fail(new Conflict({ message: "The response identity already records different content." }));
	}
	if ((yield* snapshot).model.ids.get(input.id)?.[0]?.file !== `responses/${input.id}.md`) {
		return yield* Effect.fail(new Conflict({ message: "The saved response moved. Read its existing record instead of retrying a write." }));
	}
	yield* publish(options.root, options.realRoot, existing.id, responseMarkdown(existing));
});
