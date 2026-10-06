import { Effect } from "effect";
import { type DraftInput, type RecordedResponse, ResponseFailed } from "#browser/responses/schema.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { publish } from "./publish.ts";
import { matchesResponse, responseMarkdown } from "./records.ts";
import type { ResponseOptions } from "./service.ts";

export const retryResponse = Effect.fn("WorkBoard.retryResponse")(function* (
	existing: RecordedResponse,
	input: DraftInput,
	snapshot: Effect.Effect<Snapshot, ResponseFailed>,
	options: ResponseOptions,
) {
	if (!matchesResponse(existing, input)) {
		return yield* Effect.fail(new ResponseFailed({ code: "Conflict", message: "The response identity already records different content." }));
	}
	if ((yield* snapshot).model.ids.get(input.id)?.[0]?.file !== `responses/${input.id}.md`) {
		return yield* Effect.fail(
			new ResponseFailed({ code: "Conflict", message: "The saved response moved. Read its existing record instead of retrying a write." }),
		);
	}
	yield* publish(options.root, options.changes.realRoot, existing.id, responseMarkdown(existing));
});
