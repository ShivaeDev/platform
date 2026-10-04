import { Effect } from "effect";
import { expect, it } from "vitest";
import { documentHeadings } from "./documentHeadings.ts";
import { Highlighter } from "./highlighter.ts";
import { renderMarkdown } from "./markdown.ts";

it("assigns unambiguous Unicode anchors across board fragments and ignores footnote headings", async () => {
	const headings = documentHeadings();
	const result = await Effect.runPromise(
		Effect.gen(function* () {
			const first = yield* renderMarkdown("# **Evidence**\n\n## Evidence\n\nA claim.[^source]\n\n[^source]: Proof.", { headings });
			const second = yield* renderMarkdown('### Evidence-2\n\n### Evidence\n\n## Απόφαση\n\n## !!!\n\n<h2 id="authored">Kept</h2>', { headings });
			return first + second;
		}).pipe(Effect.provide(Highlighter.layer)),
	);
	expect(headings.entries.map(({ id }) => id)).toEqual([
		"heading-evidence",
		"heading-evidence-2",
		"heading-evidence-2-2",
		"heading-evidence-3",
		"heading-απόφαση",
		"heading-section",
	]);
	expect(headings.entries[0]?.title).toBe("Evidence");
	expect(result).toContain('href="#heading-evidence-3"');
	expect(result).toContain('href="#user-content-fn-source"');
	expect(headings.entries).toHaveLength(6);
	expect(result).toContain('<h2 id="authored">Kept</h2>');
});
