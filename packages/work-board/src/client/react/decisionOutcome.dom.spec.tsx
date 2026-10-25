import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { questionId, responseMarkdown, revisionOf } from "#server/responses/records.ts";
import { decisionFile, decisionId, readyDecisionFixture } from "#test/answerCardFixture.ts";
import { answeredDecisionFixture } from "#test/answeredDecisionFixture.ts";
import { closedDecision, unansweredDecision } from "#test/itemHeaderFixture.ts";
import { reviewedDecisionId, reviewedWorkFixture } from "#test/reviewedWorkFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const OUTCOME = "article.doc > [data-decision-outcome]";
const AUTHORED = {
	"home.md": "# Home",
	"seven.md": `---\n${JSON.stringify({
		attention: [{ id: "design", kind: "decision", reason: "These choices are yours.", "response_from": ["maintainer"], state: "closed" }],
		id: "decision.seven",
		kind: "question",
		scope: "task",
		status: "done",
		urgency: "whenever",
	})}\n---\n# Seven design questions\n\nThe choices where a maintainer could go either way.\n`,
};
const question = questionId(decisionId, "direction", revisionOf(readyDecisionFixture[decisionFile] ?? ""), decisionFile);
const competing = {
	...closedDecision(answeredDecisionFixture()),
	"responses/response.direction-release.md": responseMarkdown({
		body: "Stop and hand back",
		id: "response.direction-release",
		response: {
			answers: [{ prompt: "fleet-action", selected: ["release"], text: "Hand it back before the release." }],
			author: "orchestrator",
			question,
			recordedAt: 3000,
			reviewedRevision: revisionOf(readyDecisionFixture[decisionFile] ?? ""),
			type: "answer",
		},
	}),
};
const quietPacket = Object.fromEntries(
	Object.entries(reviewedWorkFixture()).map(([file, source]) => [
		file,
		file.startsWith("responses/")
			? source.replace('"state":"open"', '"state":"closed"').replace("<https://github.com/example/project/pull/12>", "")
			: source,
	]),
);

screenStory.it(
	"leads a closed Fleet decision with the recorded choice, who made it and when, under a title naming the work",
	[routedScreen(closedDecision(answeredDecisionFixture()), `/_board/item/${decisionId}/`, { home: "home.md" })],
	function* ({ findElement, readText, readTitle }) {
		yield* eventually(() => expect(findElement(OUTCOME)).not.toBeNull());
		expect(findElement("article.doc")?.firstElementChild).toBe(findElement(OUTCOME));
		expect(readText(`${OUTCOME} h2`)).toBe("Outcome");
		expect(readText(`${OUTCOME} [data-outcome-answer] > p:first-child`)).toBe("Request changes");
		expect(readText(`${OUTCOME} [data-outcome-answer] > p:last-child`)).toMatch(/^Answered by maintainer \S/u);
		expect(findElement(`${OUTCOME} a[href='/responses/response.direction-retry.md']`)).not.toBeNull();
		expect(findElement(`${OUTCOME} time[data-modified='2000']`)).not.toBeNull();
		expect(readText(".item-introduction h1")).toBe("Fleet decision: Publish the install guide");
		expect(readTitle()).toContain("Fleet decision: Publish the install guide");
		expect(findElement("main[data-decision-packet]")).not.toBeNull();
	},
);

screenStory.it(
	"shows every author's current answer with its note when answers compete",
	[routedScreen(competing, `/_board/item/${decisionId}/`, { home: "home.md" })],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() =>
			expect(findElements(`${OUTCOME} [data-outcome-answer]`).map((answer) => answer.getAttribute("data-outcome-answer"))).toEqual([
				"response.direction-retry",
				"response.direction-release",
			]),
		);
		const release = findElement(`${OUTCOME} [data-outcome-answer='response.direction-release']`);
		expect(readText("p:first-child", release)).toBe("Stop and hand back");
		expect(readText("p:nth-child(2)", release)).toBe("Hand it back before the release.");
		expect(readText("p:last-child", release)).toMatch(/^Answered by orchestrator \S/u);
		expect(readText(`${OUTCOME} [data-outcome-answer='response.direction-retry'] > p:first-child`)).toBe("Request changes");
	},
);

screenStory.it(
	"says plainly that a closed decision has no recorded answer instead of showing an empty outcome",
	[routedScreen(AUTHORED, "/_board/item/decision.seven/", { home: "home.md" })],
	function* ({ findElement, readText }) {
		yield* eventually(() => expect(findElement(OUTCOME)).not.toBeNull());
		expect(findElement("article.doc")?.firstElementChild).toBe(findElement(OUTCOME));
		expect(readText(`${OUTCOME} p`)).toBe("Closed with no answer recorded on the Board.");
		expect(findElement(`${OUTCOME} [data-outcome-answer]`)).toBeNull();
		expect(readText(".item-introduction h1")).toBe("Seven design questions");
		expect(findElement("main[data-decision-packet]")).toBeNull();
	},
);

screenStory.it(
	"shows no outcome while a decision still waits for its answer",
	[routedScreen(unansweredDecision(), `/_board/item/${decisionId}/`, { home: "home.md" })],
	function* ({ findElement }) {
		yield* eventually(() => expect(findElement("article.doc")).not.toBeNull());
		expect(findElement("[data-decision-outcome]")).toBeNull();
	},
);

screenStory.it(
	"hides a Fleet packet's empty sections and keeps its fenced decision text as plain, wrappable text",
	[routedScreen(quietPacket, `/_board/item/${reviewedDecisionId}/`, { home: "tasks/upload.md" })],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(findElement(OUTCOME)).not.toBeNull());
		expect(findElements("article.doc h2").map((heading) => heading.textContent)).toEqual([
			"Outcome",
			"Decision",
			"Recommendation",
			"Reviewed Board work",
		]);
		expect(readText(`${OUTCOME} p`)).toBe("Closed with no answer recorded on the Board.");
		const fences = findElements("article.doc pre");
		expect(fences.map((fence) => fence.textContent?.trim())).toEqual(["Reviewed PR is ready to merge", "Merge the reviewed PR"]);
		expect(fences.every((fence) => fence.className === "" && fence.closest("main[data-decision-packet]") !== null)).toBe(true);
	},
);
