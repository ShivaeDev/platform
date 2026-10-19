import { inboxAudienceFixture } from "./inboxAudienceFixture.ts";
import { todayFixture } from "./todayFixture.ts";

const FLEET_DECISION = `---
${JSON.stringify({
	attention: [
		{
			id: "task.ship.1",
			kind: "decision",
			managed: true,
			reason: "The PR passed review and all required checks. It is ready to merge.",
			"response_from": ["maintainer"],
			state: "open",
			unblocks: ["task.ship"],
		},
	],
	id: "decision.ship",
	kind: "decision",
	relationships: [{ kind: "relates_to", target: "task.ship" }],
})}
---
# Fleet decision for task.ship

::::question{id="fleet-action" select="one"}
### Do you want changes before merging?

:::option{id="retry"}
### Request changes
The worker makes the changes on the same branch and PR.
:::
:::option{id="release"}
### Stop and hand back
Fleet stops watching this PR. The PR stays open.
:::
::::
`;

function decision(id: string, title: string, questions: string): string {
	return `---
id: decision.${id}
kind: decision
attention:
  - id: direction
    kind: decision
    state: open
    reason: ${title}
    response_from: [maintainer]
    unblocks: [decision.${id}]
---
# ${title}

${questions}`;
}

function question(id: string, select: string, heading: string, options: readonly string[], request = ""): string {
	const choices = options.map((option) => `:::option{id="${option}"}\nChoose ${option}.\n:::\n`).join("");
	return `::::question{id="${id}" select="${select}"${request}}\n### ${heading}\n\n${choices}::::\n`;
}

export function todayRowsFixture(): Record<string, string> {
	return {
		...todayFixture(),
		"decisions/broken.md": decision(
			"broken",
			"Which mirror should serve downloads?",
			question("mirror", "one", "Pick a mirror", ["eu"], ' request="gone"'),
		),
		"decisions/checks.md": decision(
			"checks",
			"Which checks should block a release?",
			question("checks", "many", "Pick the blocking checks", ["lint", "types"]),
		),
		"decisions/packet.md": decision(
			"packet",
			"Plan the next release",
			`${question("scope", "one", "What ships?", ["fixes", "features"])}\n${question("day", "one", "When?", ["monday", "friday"])}`,
		),
		"responses/decision.ship.md": FLEET_DECISION,
		"tasks/policy.md":
			'---\nid: docs.policy\nkind: task\nstatus: planned\nowner: maintainer\nnext_action: "Planned: every export is supported API."\n---\n# Is every module supported API?\n',
		"tasks/ship.md": "---\nid: task.ship\nkind: task\nstatus: active\nowner: codex\n---\n# Ship the upload fix\n",
	};
}

export function todayAnswerFixture(): Record<string, string> {
	return {
		"decisions/name.md": decision("name", "Name the next release", question("name", "text", "What should the release be called?", [])),
		"decisions/venue.md": decision(
			"venue",
			"Pick a venue for the launch",
			question("venue", "one", "Where should the launch happen?", ["hall", "park"]),
		),
		"home.md": "# Workspace notes\n",
		"reader.md": inboxAudienceFixture()["reader.md"] ?? "",
	};
}

export function todayContextFixture(): Record<string, string> {
	return {
		...todayAnswerFixture(),
		"decisions/launch.md": decision(
			"launch",
			"Pick the launch day",
			`${question("launch", "one", "Which day should the launch be?", ["monday", "friday"])}\n## Recommendation\n\nMonday, so the team can watch it.\n`,
		),
		"decisions/workaround.md": `---
id: decision.workaround
kind: decision
attention:
  - id: direction
    kind: decision
    state: open
    reason: Keep the startup workaround?
    response_from: [maintainer]
    unblocks: [decision.workaround]
---
# Keep the startup workaround?

Workers source the setup script in every command.

- **A. Keep the workaround (recommended).** Close the activation task as superseded.
- **B. Fix the environment.** Publish a revision that activates on its own,
  then drop the workaround.
- **C. Decide after the release.**

Answer with A, B or C.
`,
	};
}
