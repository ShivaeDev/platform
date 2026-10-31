import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

for (const [field, value] of [
	["kind", "project"],
	["kind", "decision"],
	["kind", "result"],
	["kind", "response"],
	["status", "planned"],
	["status", "active"],
	["status", "open"],
	["status", "received"],
	["status", "superseded"],
	["fleet", "none"],
	["fleet-deliverable", "report"],
	["owner", "Claude"],
	["owner", "Marvin"],
	["owner", "orchestrator"],
	["owner", "claude-code"],
	["owner", "cloud-worker"],
	["owner", "someone"],
] as const) {
	const owners = field === "owner" ? "(?=.*codex, claude or marvin)" : "";
	boardStory.it(
		`a document with the retired ${field}: ${value} is refused as a bad request naming the file, the field${field === "owner" ? ", the allowed owners" : ""} and the upgrade command`,
		[projectFiles({ "old.md": `---\nid: old\n${field === "kind" ? "" : "kind: task\n"}${field}: ${value}\n---\n# Old vocabulary\n` })],
		function* ({ documentRefusal }) {
			expect(yield* documentRefusal("old.md")).toEqual(
				expect.stringMatching(new RegExp(`^bad request: ${owners}(?=.*work-board migrate <board dir>).*old\\.md: ${field}:`, "su")),
			);
		},
	);
}
