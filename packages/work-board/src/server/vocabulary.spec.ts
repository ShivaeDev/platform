import { Effect } from "effect";
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
	boardStory.it(
		`refuses ${field}: ${value} with the file, field and upgrade command`,
		[
			projectFiles({
				"old.md": `---\nid: old\n${field === "kind" ? "" : "kind: task\n"}${field}: ${value}\n---\n# Old vocabulary\n`,
			}),
		],
		function* ({ rpc }) {
			const error = yield* rpc((client) => client("work-board.document", { url: "/old.md" })).pipe(
				Effect.match({ onFailure: (failure) => failure, onSuccess: () => undefined }),
			);
			expect(error).toMatchObject({ _tag: "BadRequest", message: expect.stringContaining(`old.md: ${field}:`) });
			expect(error?.message).toContain("work-board migrate <board dir>");
			if (field === "owner") {
				expect(error?.message).toContain("codex, claude or marvin");
			}
		},
	);
}
