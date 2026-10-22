import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { vocabularyFixture } from "#test/vocabularyFixture.ts";

boardStory.it(
	"migrates every old word in place, loads cleanly and changes nothing on a second run",
	[projectFiles(vocabularyFixture), deferredServing],
	function* ({ migrate, notes, start, connectClient }) {
		const output = migrate();
		expect(output).toBe("Changed 12 files and 34 fields.\n");
		for (const [file, source] of Object.entries(vocabularyFixture)) {
			const saved = readFileSync(join(notes.root, file), "utf8");
			function body(text: string) {
				return text.slice(text.indexOf("---", text.indexOf("---") + 3));
			}
			expect(body(saved)).toBe(body(source));
		}
		expect(readFileSync(join(notes.root, "successor.md"), "utf8")).toContain("  - kind: implements # retain this comment\n    target: goal\n");
		const saved = Object.fromEntries(Object.keys(vocabularyFixture).map((file) => [file, readFileSync(join(notes.root, file), "utf8")]));
		expect(migrate()).toBe("Changed 0 files and 0 fields.\n");
		expect(Object.fromEntries(Object.keys(vocabularyFixture).map((file) => [file, readFileSync(join(notes.root, file), "utf8")]))).toEqual(saved);
		yield* start();
		const client = connectClient();
		const goal = yield* Effect.promise(() => client.read(client.api.document.query({ url: "/_board/item/goal/" })));
		expect(goal.diagnostics).toEqual([]);
		expect(goal.metadata).toMatchObject({ kind: "goal", owner: "claude", status: "ready" });
		const ruling = yield* Effect.promise(() => client.read(client.api.document.query({ url: "/_board/item/ruling/" })));
		expect(ruling.metadata).toMatchObject({ answer: "# Ruling\n\nUse the existing engine.\n", kind: "question", scope: "standing", status: "done" });
		expect(goal.rulings?.map((entry) => entry.answer)).toEqual([ruling.metadata.answer]);
		const metadata: Readonly<Record<string, Readonly<Record<string, string>>>> = {
			"decisions/ruling.md": { kind: "question", owner: "claude", scope: "standing", status: "done" },
			"draft.md": { delivers: "report", fleet: "manual", kind: "task", owner: "codex", status: "draft" },
			"flow.md": { kind: "question", owner: "claude", status: "ready" },
			"goal.md": { kind: "goal", owner: "claude", status: "ready" },
			"last-owner.md": { owner: "claude" },
			"question.md": { kind: "question", owner: "claude", status: "ready" },
			"replaced.md": { owner: "claude", status: "dropped" },
			"report.md": { kind: "report", owner: "marvin", status: "done" },
			"successor.md": { owner: "claude" },
		};
		for (const file of Object.keys(vocabularyFixture).filter((name) => name !== "fleet/status.md")) {
			const document = yield* Effect.promise(() => client.read(client.api.document.query({ url: `/${file}` })));
			expect(document.diagnostics).toEqual([]);
			if (metadata[file] !== undefined) {
				expect(document.metadata).toMatchObject(metadata[file]);
			}
		}
		const question = yield* Effect.promise(() => client.read(client.api.document.query({ url: "/question.md" })));
		expect(question.metadata).toMatchObject({ scope: "task", status: "ready", urgency: "blocking" });
		const captured = yield* Effect.promise(() => client.read(client.api.document.query({ url: "/captured.md" })));
		expect(captured.metadata.urgency).toBe("blocking");
		const flow = yield* Effect.promise(() => client.read(client.api.document.query({ url: "/flow.md" })));
		expect(flow.metadata).toMatchObject({ scope: "task", urgency: "whenever" });
		expect(readFileSync(join(notes.root, "crlf.md"), "utf8")).toContain('kind: "goal" # retain comment\r\n');
		const successor = yield* Effect.promise(() => client.read(client.api.document.query({ url: "/_board/item/successor/" })));
		expect(successor.metadata.relationships).toContainEqual({ kind: "replaces", target: "replaced" });
	},
);
