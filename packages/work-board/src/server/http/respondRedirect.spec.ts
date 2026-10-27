import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { questionnaireSource } from "#test/questionnaire.ts";

boardStory.it(
	"redirects a legacy response URL to its answer card and rejects an unknown request",
	[projectFiles({ "decision.md": questionnaireSource }), deferredServing],
	function* ({ start, get }) {
		yield* start();
		const response = yield* get("/_board/respond?item=investigation.choices&request=direction");
		expect(response.status).toBe(HttpStatus.fromLiteral("Found"));
		expect(response.location).toBe("/_board/item/investigation.choices/#answer-card-direction");
		const missing = yield* get("/_board/respond?item=investigation.choices&request=unknown");
		expect(missing.status).toBe(HttpStatus.fromLiteral("Conflict"));
		expect(missing.location).toBeUndefined();
		expect(missing.body).toContain("Response unavailable");
	},
);
