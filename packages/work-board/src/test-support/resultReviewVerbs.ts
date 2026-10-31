import { renameSync } from "node:fs";
import { Effect } from "effect";
import { changedOutside, markup, projectPath, textIn } from "./publicationFaults.ts";
import { renderRemaining } from "./renderRemaining.tsx";
import { settledCall } from "./responseOutcome.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

const REVIEW_PATH = "/_board/item/result.keyboard/";

export function resultReviewVerbs(engine: BoardEngine, tell: (line: string) => void) {
	function review(line: string) {
		tell(line);
		return Effect.promise(async () => markup(await renderRemaining(served(engine).board.url, REVIEW_PATH)));
	}
	return {
		movedAndReindexed: (from: string, to: string) => {
			tell(`an outside editor moves ${from} to ${to}`);
			return changedOutside(engine, [from, to], () => renameSync(projectPath(engine, from), projectPath(engine, to)));
		},
		resultReading: (url: string) => {
			tell(`the reader asks for the result review at ${url}`);
			const { client } = served(engine);
			return settledCall(() => client.run(client.api.result.run({ url })));
		},
		reviewChecks: () =>
			Effect.map(review("the reader reads the checks and evidence of result.keyboard"), (page) =>
				[...page.querySelectorAll("section[aria-label]")]
					.filter((section) => section.querySelector("table, p") !== null && section.closest("[data-result-review]") !== null)
					.filter((section) => section.getAttribute("aria-label") !== "Review")
					.map((section) => ({
						item: section.getAttribute("aria-label"),
						rows: [...section.querySelectorAll("tbody tr")].map((row) => [...row.querySelectorAll("td")].map(textIn)),
						status: textIn(section.querySelector("[data-status-token]")),
					})),
			),
		reviewedRevisions: () =>
			Effect.map(review("the reader reads which report revision each feedback reviewed"), (page) =>
				[...page.querySelectorAll("article[data-matching] details code")].map(textIn),
			),
		reviewFeedback: () =>
			Effect.map(review("the reader reads the feedback on result.keyboard"), (page) =>
				[...page.querySelectorAll("article[data-matching]")].map((entry) => {
					const replaces = [...entry.querySelectorAll("p")].find((line) => textIn(line)?.startsWith("Replaces earlier feedback"));
					return {
						file: [...entry.querySelectorAll("a")].find((link) => textIn(link) === "Response file")?.getAttribute("href"),
						id: entry.id,
						version: entry.getAttribute("data-matching") === "true" ? "this version" : "earlier version",
						...(replaces ? { replaces: replaces.querySelector("a")?.getAttribute("href") } : {}),
					};
				}),
			),
		unreadableFeedback: () =>
			Effect.map(review("the reader reads which feedback on result.keyboard could not be read"), (page) => ({
				files: [...page.querySelectorAll("[data-unreadable-feedback] li")].map(textIn),
				sourceProblems: [...page.querySelectorAll("a")].find((link) => textIn(link) === "See source problems in System")?.getAttribute("href"),
			})),
	};
}
