import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { reviewedDecisionId, reviewedWorkFixture } from "#test/reviewedWorkFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const decision = `/_board/item/${reviewedDecisionId}/`;

screenStory.it(
	"shows the work a Fleet decision reviewed as its title, criteria and description instead of raw front matter",
	[routedScreen(reviewedWorkFixture(), decision, { home: "tasks/upload.md" })],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(readText("article.doc")).toContain("Reviewed Board work"));
		const heading = findElements("article.doc h2").find((section) => section.textContent === "Reviewed Board work");
		const shown: Element[] = [];
		for (let node = heading?.nextElementSibling; node && node.tagName !== "H2"; node = node.nextElementSibling) {
			shown.push(node);
		}
		expect(shown.map((node) => node.tagName)).toEqual(["P", "P", "UL", "BLOCKQUOTE"]);
		expect(shown[0]?.textContent).toBe("Fix the flaky upload test · task.upload");
		expect(shown[1]?.textContent).toBe("Criteria:");
		expect(findElements("li", shown[2]).map((item) => item.textContent)).toEqual([
			"The upload test passes 50 runs in a row.",
			"The pull request names the race.",
		]);
		expect(shown[3]?.textContent?.trim()).toBe("The upload test fails about once in twenty runs.");
		expect(findElement("article.doc pre")).toBeNull();
	},
);

screenStory.it(
	"keeps reviewed work without readable front matter as the agent wrote it",
	[routedScreen(reviewedWorkFixture("Plain notes from the reviewer."), decision, { home: "tasks/upload.md" })],
	function* ({ readText }) {
		yield* eventually(() => expect(readText("article.doc pre")?.trim()).toBe("Plain notes from the reviewer."));
	},
);

screenStory.it(
	"names untitled reviewed work by its id and shows no criteria it does not have",
	[routedScreen(reviewedWorkFixture("---\nid: task.untitled\nkind: task\n---\nOnly a description."), decision, { home: "tasks/upload.md" })],
	function* ({ readText }) {
		yield* eventually(() => expect(readText("article.doc blockquote")?.trim()).toBe("Only a description."));
		expect(readText("article.doc")).toContain("task.untitled · task.untitled");
		expect(readText("article.doc")).not.toContain("Criteria:");
		expect(readText("article.doc pre")).toBeUndefined();
	},
);
