import type { ScreenEngine } from "./screenEngine.ts";
import { accessibleOf, shellActs } from "./shellScreenAct.ts";

const PARTS = {
	checks: "#result-criteria",
	feedback: "#result-feedback",
	note: "[data-result-empty]",
	report: "#doc article[data-source]",
	"review request": "#answer-card-review",
	unavailable: "[data-result-unavailable]",
} as const;

function text(element: Element | null | undefined) {
	return element?.textContent ?? "";
}

export function shellResultVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { reading } = shellActs(engine, tell);
	return {
		feedbackProblems: () =>
			reading("the reader reads which feedback on the result could not be read", () => {
				const list = document.querySelector("[data-unreadable-feedback]");
				if (!list) {
					return "none";
				}
				const alert = document.querySelector("#result-feedback [role='alert']");
				return {
					alert: text(alert),
					files: [...list.querySelectorAll("li")].map((file) => ({ href: file.querySelector("a")?.getAttribute("href"), text: text(file) })),
					sourceProblems: [...(alert?.querySelectorAll("a[href^='/_board/system']") ?? [])].map((link) => [text(link), link.getAttribute("href")]),
				};
			}),
		pageActions: () =>
			reading("the reader reads the page's action controls", () =>
				[...document.querySelectorAll("[data-page-actions] :is(a, button)")].map((control) => ({
					href: control.getAttribute("href") ?? "none",
					name: accessibleOf(control).name,
					role: accessibleOf(control).role,
				})),
			),
		pageModified: () =>
			reading("the reader reads when the page's file last changed", () =>
				document.querySelector("#doc [data-page-header] time[data-modified]")?.getAttribute("datetime"),
			),
		reportText: () => reading("the reader reads the report", () => text(document.querySelector(PARTS.report))),
		resultChecks: () =>
			reading("the reader reads the checks listed for each linked item", () =>
				[...document.querySelectorAll("#result-criteria section[aria-label]")].map((section) => ({
					columns: [...section.querySelectorAll("th")].map(text),
					item: section.getAttribute("aria-label"),
					link: text(section.querySelector("a")),
					revision: section.querySelector("tbody code")?.getAttribute("title") ?? "none",
					rows: [...section.querySelectorAll("tbody tr")].map((row) => [...row.querySelectorAll("td")].map(text)),
					status: text(section.querySelector("[data-status-token]")) || "none",
					text: text(section),
				})),
			),
		resultFeedback: () =>
			reading("the reader reads each piece of feedback and the report version it was written for", () =>
				[...document.querySelectorAll("#result-feedback article")].map((entry) => {
					const reviewed = entry.querySelector("[data-reviewed-version]");
					const time = reviewed?.querySelector("time");
					return {
						author: text(entry.querySelector("h3")),
						hash: text(entry.querySelector("details code")) || "none",
						reviewed: text(reviewed).replace(text(time), "{time}"),
						when: time?.getAttribute("datetime"),
					};
				}),
			),
		resultLinkedWork: () =>
			reading("the reader reads the work this result is linked to", () => {
				const linked = document.querySelector("[data-result-linked]");
				if (!linked) {
					return "none";
				}
				return [...linked.querySelectorAll("li")].map((row) => {
					const links = [...row.querySelectorAll("a")];
					const followUp = links.find((link) => accessibleOf(link).name.startsWith("Prepare follow-up handoff"));
					const work = links.find((link) => link !== followUp);
					return {
						followUp: followUp ? [accessibleOf(followUp).name, followUp.getAttribute("href")] : "none",
						link: work?.getAttribute("href") ?? "none",
						name: work ? text(work) : text(row),
						status: text(row.querySelector("[data-status-token]")) || "none",
					};
				});
			}),
		resultNote: () => reading("the reader reads the result's one-line note", () => text(document.querySelector(PARTS.note)) || "none"),
		resultParts: () =>
			reading("the reader reads which parts of the result page show, top to bottom", () =>
				Object.entries(PARTS)
					.flatMap(([part, selector]) => {
						const element = document.querySelector(selector);
						return element ? [{ element, part }] : [];
					})
					.sort((a, b) => (a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
					.map(({ part }) => part),
			),
		resultUnavailable: () =>
			reading("the reader reads why checks and feedback are missing", () => text(document.querySelector(PARTS.unavailable)) || "none"),
	};
}
