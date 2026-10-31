import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { questionnaireSource } from "#test/questionnaire.ts";

const decision = projectFiles({ "decision.md": questionnaireSource }, "decision.md asks investigation.choices for direction");

boardStory.it("a legacy response URL redirects to the request's answer card", [decision], function* ({ download }) {
	expect(yield* download("/_board/respond?item=investigation.choices&request=direction")).toMatchObject({
		location: "/_board/item/investigation.choices/#answer-card-direction",
		status: "Found",
	});
});

boardStory.it("a legacy response URL for an unknown request answers Conflict without redirecting", [decision], function* ({ download }) {
	expect(yield* download("/_board/respond?item=investigation.choices&request=unknown")).toMatchObject({
		location: undefined,
		status: "Conflict",
		text: expect.stringContaining("Response unavailable"),
	});
});
