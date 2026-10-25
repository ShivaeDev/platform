export const STANDING_QUESTION_FILE = "decisions/release-policy.md";
export const STANDING_QUESTION_ID = "decision.release-policy";
export const STANDING_QUESTION_REASON = "Choose the standing release policy.";
export const STANDING_QUESTION_SOURCE = `---
id: ${STANDING_QUESTION_ID}
kind: question
scope: standing
urgency: whenever
owner: marvin
next_action: ${STANDING_QUESTION_REASON}
attention:
  - id: policy
    kind: decision
    state: open
    response_from: [maintainer]
    reason: ${STANDING_QUESTION_REASON}
    unblocks: [${STANDING_QUESTION_ID}]
---
# Standing release policy

::::question{id="release-policy" select="one"}
### When should releases ship?
:::option{id="reviewed"}
### After review
Ship each reviewed change.
:::
:::option{id="weekly"}
### Every week
Wait for the weekly release.
:::
::::
`;

export function standingQuestionFixture() {
	return { "home.md": "# Project notes\n", [STANDING_QUESTION_FILE]: STANDING_QUESTION_SOURCE };
}
