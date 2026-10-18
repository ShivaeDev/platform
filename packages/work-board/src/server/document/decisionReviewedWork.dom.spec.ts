import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import { reviewedDecisionId, reviewedWorkFixture } from "#test/reviewedWorkFixture.ts";

boardStory.it(
	"shows the work a Fleet decision reviewed as its title, criteria and description instead of raw front matter",
	[projectFiles(reviewedWorkFixture()), readerAt(`/_board/item/${reviewedDecisionId}/`)],
	function* ({ page }) {
		function body() {
			return page.document.querySelector("article.doc");
		}
		yield* Effect.promise(() => waitFor(() => expect(body()?.textContent).toContain("Reviewed Board work")));
		const section = [...(body()?.querySelectorAll("h2") ?? [])].find((heading) => heading.textContent === "Reviewed Board work");
		const shown: string[] = [];
		for (let node = section?.nextElementSibling; node && node.tagName !== "H2"; node = node.nextElementSibling) {
			shown.push(node.textContent?.trim() ?? "");
		}
		expect(shown).toEqual([
			"Fix the flaky upload test · task.upload",
			"Criteria:",
			"The upload test passes 50 runs in a row.\nThe pull request names the race.",
			"The upload test fails about once in twenty runs.",
		]);
		expect(body()?.querySelector("pre")).toBeNull();
	},
);

boardStory.it(
	"keeps reviewed work without readable front matter as the agent wrote it",
	[projectFiles(reviewedWorkFixture("Plain notes from the reviewer.")), readerAt(`/_board/item/${reviewedDecisionId}/`)],
	function* ({ page }) {
		yield* Effect.promise(() =>
			waitFor(() => expect(page.document.querySelector("article.doc pre")?.textContent?.trim()).toBe("Plain notes from the reviewer.")),
		);
	},
);

boardStory.it(
	"names untitled reviewed work by its id and shows no criteria it does not have",
	[
		projectFiles(reviewedWorkFixture("---\nid: task.untitled\nkind: task\n---\nOnly a description.")),
		readerAt(`/_board/item/${reviewedDecisionId}/`),
	],
	function* ({ page }) {
		yield* Effect.promise(() =>
			waitFor(() => expect(page.document.querySelector("article.doc blockquote")?.textContent?.trim()).toBe("Only a description.")),
		);
		const body = page.document.querySelector("article.doc")?.textContent ?? "";
		expect(body).toContain("task.untitled · task.untitled");
		expect(body).not.toContain("Criteria:");
	},
);
