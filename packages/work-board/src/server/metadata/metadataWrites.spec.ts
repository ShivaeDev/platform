import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { DECISION_SOURCE, MALFORMED_SOURCE, PLAIN_SOURCE, TASK_SOURCE, WINDOWS_SOURCE } from "#test/headlessWorkspaceFixture.ts";
import { headlessWorkspaceStory, readOnlyWorkspace, workspaceFiles } from "#test/headlessWorkspaceStory.ts";

const task = workspaceFiles({ "task.md": TASK_SOURCE });
const decision = workspaceFiles({ "decision.md": DECISION_SOURCE, "task.md": TASK_SOURCE });

headlessWorkspaceStory.it("task metadata writes preserve unknown fields and the Markdown body", [task], function* ({ metadata, writeMetadata }) {
	const original = yield* metadata();

	const result = yield* writeMetadata(original.source, { "next_action": "Review the result", status: "done" });

	yield* outcomes([
		["save outcome", () => Effect.succeed(result), "saved"],
		[
			"saved metadata and body",
			() => metadata(),
			{
				parsed: { body: original.parsed.body },
				values: { custom: { tracking: ["one", "two"] }, "fleet-priority": 7, "next_action": "Review the result", status: "done" },
			},
		],
	]);
});

for (const action of ["task metadata", "decision closure"] as const) {
	headlessWorkspaceStory.it(
		`${action} refuses a changed source and keeps the editor's bytes`,
		[decision],
		function* ({ closeDecision, editorWrites, metadata, writeMetadata }) {
			const file = action === "task metadata" ? "task.md" : "decision.md";
			const original = yield* metadata(file);
			const changed = `${original.source}\nAn editor added context.\n`;
			yield* editorWrites(file, changed);

			const result = yield* action === "task metadata" ? writeMetadata(original.source, { status: "done" }) : closeDecision(original.source);

			yield* outcomes([
				["write refusal", () => Effect.succeed(result), "source changed: Source changed; no file was replaced."],
				["editor's source", () => metadata(file), { source: changed }],
			]);
		},
	);
}

headlessWorkspaceStory.it("workspace writes require explicit opt-in", [task, readOnlyWorkspace], function* ({ metadata, writeMetadata }) {
	const result = yield* writeMetadata(TASK_SOURCE, { status: "done" });

	yield* outcomes([
		["write refusal", () => Effect.succeed(result), "writes disabled: Enable workspace writes explicitly with writable: true."],
		["unchanged source", () => metadata(), { source: TASK_SOURCE }],
	]);
});

headlessWorkspaceStory.it(
	"metadata writes add frontmatter to plain Markdown without changing its body",
	[workspaceFiles({ "task.md": PLAIN_SOURCE })],
	function* ({ metadata, writeMetadata }) {
		const original = yield* metadata();

		const result = yield* writeMetadata(original.source, { id: "task", kind: "task", status: "ready" });

		yield* outcomes([
			["save outcome", () => Effect.succeed(result), "saved"],
			[
				"new metadata and original body",
				() => metadata(),
				{ parsed: { body: "\n# Plain note\n" }, values: { id: "task", kind: "task", status: "ready" } },
			],
		]);
	},
);

headlessWorkspaceStory.it(
	"metadata writes preserve the body's Windows newlines and opening byte order mark",
	[workspaceFiles({ "task.md": WINDOWS_SOURCE })],
	function* ({ metadata, writeMetadata }) {
		const original = yield* metadata();

		const result = yield* writeMetadata(original.source, { status: "done" });

		yield* outcomes([
			["save outcome", () => Effect.succeed(result), "saved"],
			["opening byte order mark and CRLF", () => Effect.map(metadata(), ({ source }) => source.startsWith("\uFEFF---\r\n")), true],
			["unchanged body", () => metadata(), { parsed: { body: original.parsed.body } }],
		]);
	},
);

headlessWorkspaceStory.it(
	"metadata writes refuse malformed YAML without replacing the source",
	[workspaceFiles({ "task.md": MALFORMED_SOURCE })],
	function* ({ storedSource, writeMetadata }) {
		const source = yield* storedSource();

		const result = yield* writeMetadata(source, { status: "done" });

		yield* outcomes([
			["write refusal", () => Effect.succeed(result), "invalid metadata: Frontmatter must be a valid YAML mapping."],
			["unchanged source", () => storedSource(), source],
		]);
	},
);
