import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { folder, rawGet, startBoard } from "#test/board.ts";
import { questionnaireSource } from "#test/questionnaire.ts";

it.live("redirects a legacy response URL to its answer card and rejects an unknown request", function* () {
	const notes = yield* Effect.acquireRelease(
		Effect.sync(() => folder({ "decision.md": questionnaireSource })),
		(value) => Effect.sync(value.remove),
	);
	const board = yield* startBoard(notes.root);
	const response = yield* rawGet(board, "/_board/respond?item=investigation.choices&request=direction");
	expect(response.status).toBe(302);
	expect(response.location).toBe("/_board/item/investigation.choices/#answer-card-direction");
	const missing = yield* rawGet(board, "/_board/respond?item=investigation.choices&request=unknown");
	expect(missing.status).toBe(409);
	expect(missing.location).toBeUndefined();
	expect(missing.body).toContain("Response unavailable");
});
