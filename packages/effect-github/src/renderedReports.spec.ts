import { expect } from "vitest";
import { github } from "#test/github.ts";
import { codeSpan, plainText, tableCell } from "./markdown.ts";
import { renderRows } from "./markdownRows.ts";

const HOSTILE = "`bad`` |\r\n<script>@org/team #123 [click](https://evil.test) 😀";
const HEADER = "| Name | Error |\n| --- | --- |";
const EXPECTED =
	"| Name | Error |\n| --- | --- |\n| &#96;bad&#96;&#96; &#124; &#60;script&#62;&#64;&#8203;org&#47;team &#35;&#8203;123 &#91;click&#93;&#40;https&#58;&#47;&#47;evil&#46;test&#41; 😀 | ``` `bad`` \\| <script>@org/team #123 [click](https://evil.test) 😀 ``` |";

for (const destination of ["comment", "check"] as const) {
	github.it(
		`posts hostile text inside table cells and code spans in a ${destination}`,
		[],
		function* ({ upsertComment, readComments, createCheck, readCheck }) {
			const body = `${plainText("<b>@team #123 [link](url)</b>")}\n\n${codeSpan(HOSTILE)}\n\n${renderRows([`| ${tableCell(HOSTILE)} | ${tableCell(HOSTILE, "code")} |`], { header: HEADER })}`;
			const expectedBody = `&#60;b&#62;&#64;&#8203;team &#35;&#8203;123 &#91;link&#93;&#40;url&#41;&#60;&#47;b&#62;\n\n\`\`\` \`bad\`\` | <script>@org/team #123 [click](https://evil.test) 😀 \`\`\`\n\n${EXPECTED}`;
			if (destination === "comment") {
				yield* upsertComment({ body, marker: "report" });
				expect((yield* readComments()).map((comment) => comment.body)).toEqual([`<!-- report -->\n${expectedBody}`]);
			} else {
				const check = yield* createCheck({
					headSha: "a".repeat(40),
					name: "Tests",
					output: { summary: body, title: "Tests" },
					status: "in_progress",
				});
				expect((yield* readCheck(check.id)).output.summary).toBe(expectedBody);
			}
		},
	);

	github.it(
		`drops whole rows under a lowered byte budget in a ${destination}`,
		[],
		function* ({ upsertComment, readComments, createCheck, readCheck }) {
			const rows = Array.from({ length: 1000 }, () => `| ${tableCell("😀", "code")} |`);
			const expectedBody = "| Name |\n| --- |\n| `😀` |\n\nand 999 more";
			const byteLimit = 41;
			const body = renderRows(rows, { byteLimit, header: "| Name |\n| --- |" });
			expect(body).toBe(expectedBody);
			expect(new TextEncoder().encode(body).byteLength).toBe(byteLimit);
			expect(renderRows(rows, { byteLimit: byteLimit - 1, header: "| Name |\n| --- |" })).toBe("| Name |\n| --- |\n\nand 1000 more");
			if (destination === "comment") {
				yield* upsertComment({ body, marker: "report" });
				const [comment] = yield* readComments();
				expect(comment?.body).toBe(`<!-- report -->\n${expectedBody}`);
				expect(new TextEncoder().encode(comment?.body).byteLength).toBeLessThanOrEqual(byteLimit + 16);
			} else {
				const check = yield* createCheck({
					headSha: "b".repeat(40),
					name: "Tests",
					output: { summary: body, title: "Tests" },
					status: "in_progress",
				});
				expect((yield* readCheck(check.id)).output.summary).toBe(expectedBody);
			}
		},
	);
	github.it(`bounds a default report posted to a ${destination}`, [], function* ({ upsertComment, readComments, createCheck, readCheck }) {
		const rows = Array.from({ length: 20_000 }, () => `| ${tableCell("😀", "code")} |`);
		const body = renderRows(rows);
		const expectedBody = `${Array.from({ length: 5453 }, () => "| `😀` |").join("\n")}\n\nand 14547 more`;
		if (destination === "comment") {
			yield* upsertComment({ body, marker: "report" });
			const [comment] = yield* readComments();
			expect(comment?.body).toBe(`<!-- report -->\n${expectedBody}`);
			expect(new TextEncoder().encode(comment?.body).byteLength).toBeLessThan(65_536);
		} else {
			const check = yield* createCheck({ headSha: "c".repeat(40), name: "Tests", output: { summary: body, title: "Tests" }, status: "in_progress" });
			const summary = (yield* readCheck(check.id)).output.summary;
			expect(summary).toBe(expectedBody);
			expect(new TextEncoder().encode(summary ?? "").byteLength).toBeLessThan(65_535);
		}
	});
}
