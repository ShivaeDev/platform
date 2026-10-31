import { Effect } from "effect";
import { answerBox, answerCardReads, card, describeOption, PARTS, required } from "./answerCardReads.ts";
import { screenData } from "./screenData.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function answerCardVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { accessible, read, choice } = answerCardReads(engine, tell);
	return {
		answerBoxState: (prompt?: string) =>
			read(`the reader looks at the ${prompt ?? "answer"} box`, () => {
				const box = answerBox(prompt);
				return {
					focused: document.activeElement === box,
					selection: [box.selectionStart, box.selectionEnd],
					text: box.value,
				};
			}),
		answerCardLock: () =>
			read("the reader checks whether the answer card accepts input", () => {
				const form = document.querySelector<HTMLFormElement>("#response-form");
				function locked(element: Element | null | undefined) {
					if (element === null || element === undefined) {
						return "missing";
					}
					return element.matches(":disabled") || element.closest("fieldset")?.disabled === true ? "locked" : "open";
				}
				return {
					answer: locked(form?.querySelector("textarea")),
					notice: form?.querySelector("button[type='submit'] ~ p[role='status']")?.textContent ?? "none",
					record: locked(form?.querySelector("button[type='submit']")),
				};
			}),
		answeredNote: () =>
			read("the reader reads what the card says was answered", () => card()?.querySelector("[data-answered]")?.textContent ?? "none"),
		answerHistory: () =>
			read("the reader reads the choices listed under Answers so far", () =>
				[...(card()?.querySelectorAll("article") ?? [])].map((answer) => answer.querySelector("strong")?.textContent ?? "no choice"),
			),
		answerStatusLine: () => read("the reader reads the answer status line", () => document.querySelector("#response-status")?.textContent ?? "none"),
		cardLinks: () =>
			read("the reader reads the answer card's links", () =>
				[...(card()?.querySelectorAll<HTMLAnchorElement>(".answer-links a") ?? [])].map((link) => ({
					href: link.getAttribute("href"),
					name: link.textContent,
					primary: link.dataset.variant === "default" || link.classList.contains("bg-primary"),
				})),
			),
		cardOptions: () =>
			read("the reader reads the answer card's options", () => [...(card()?.querySelectorAll(".question-choice") ?? [])].map(describeOption)),
		cardParts: () =>
			read("the reader reads the answer card from top to bottom", () => {
				const within = card();
				if (!within) {
					return [];
				}
				return PARTS.flatMap(([name, selector]) => {
					const found = [...within.querySelectorAll(selector)].find((element) => element.closest("details") === null || name === "More options");
					return found ? [{ found, name }] : [];
				})
					.sort((left, right) => (left.found.compareDocumentPosition(right.found) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
					.map(({ name }) => name);
			}),
		cardReason: () =>
			read("the reader reads why the card asks", () => {
				const reason = card()?.querySelector(".answer-reason");
				return {
					links: [...(reason?.querySelectorAll("a") ?? [])].map((link) => link.getAttribute("href")),
					paragraphs: [...(reason?.querySelectorAll("p") ?? [])].map((paragraph) => paragraph.textContent),
				};
			}),
		cardRecommendation: () =>
			read("the reader reads the answer card's recommendation", () => card()?.querySelector(".answer-recommendation")?.textContent ?? "none"),
		cardTitle: () => read("the reader reads the answer card's title", () => card()?.querySelector("h2")?.textContent ?? "no answer card"),
		chosenOptions: () =>
			read("the reader reads which options are chosen", () =>
				[...document.querySelectorAll<HTMLElement>("[data-choice][aria-checked='true']")].map((element) => element.dataset.choice),
			),
		currentRoute: () =>
			read("the reader reads the current route", () => {
				const location = engine.router?.state.location;
				return location ? `${location.pathname}${location.hash ? `#${location.hash}` : ""}` : "none";
			}),
		documentText: () => read("the reader reads the item's document", () => document.querySelector("article.doc")?.textContent ?? ""),
		fieldProblems: () =>
			read("the reader reads the problems marked on the answer's fields", () => {
				const problems = [...document.querySelectorAll<HTMLElement>("#response-form .response-field-error")];
				return {
					ids: new Set(problems.map((problem) => problem.id)).size === problems.length ? "each its own" : "shared",
					shown: problems.filter((problem) => !problem.hidden).map((problem) => problem.textContent),
				};
			}),
		fileLocation: () =>
			read("the reader reads the file location trail", () => document.querySelector('[aria-label="File location"]')?.textContent ?? ""),
		focusedControl: () =>
			read("the reader checks where keyboard focus is", () => {
				const active = document.activeElement ?? document.body;
				const { name, role } = accessible(active);
				return role === "status" ? { role, text: active.textContent } : { name, role };
			}),
		itemHeading: () => read("the reader reads the item's heading", () => document.querySelector(".item-introduction h1")?.textContent ?? "none"),
		itemLayout: () =>
			read("the reader reads the order of the item page's sections", () =>
				(
					[
						["header", ".item-introduction"],
						["answer cards", ".answer-cards"],
						["document", "article.doc"],
					] as const
				)
					.flatMap(([name, selector]) => {
						const found = document.querySelector(selector);
						return found ? [{ found, name }] : [];
					})
					.sort((left, right) => (left.found.compareDocumentPosition(right.found) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
					.map(({ name }) => name),
			),
		itemStatus: () =>
			read("the reader reads the item's status", () => document.querySelector(".item-summary [data-status-token]")?.textContent ?? "none"),
		moreOptions: () =>
			read("the reader reads More options", () => {
				const more = document.querySelector<HTMLDetailsElement>("details[data-key='response-details']");
				return {
					choices: [...(more?.querySelectorAll<HTMLElement>("[role='combobox']") ?? [])].map(
						(combobox) =>
							`${document.querySelector(`label[for="${CSS.escape(combobox.id)}"]`)?.textContent}: ${combobox.querySelector("[data-slot='select-value']")?.textContent}`,
					),
					text: more?.textContent ?? "",
				};
			}),
		moreOptionsState: () =>
			read("the reader checks whether More options is open", () => {
				const more = document.querySelector<HTMLDetailsElement>("details[data-key='response-details']");
				if (!more) {
					return "missing";
				}
				return more.open ? "open" : "closed";
			}),
		optionControls: () =>
			read("the reader reads how each option is announced and whether Tab stops on it", () =>
				[...document.querySelectorAll<HTMLElement>("[data-choice]")].map(
					(element) => `${element.dataset.choice}: ${element.getAttribute("role")}, ${element.tabIndex >= 0 ? "tab stop" : "skipped by Tab"}`,
				),
			),
		questionReading: (prompt: string, option?: string) =>
			read(`the reader reads ${option === undefined ? `question ${prompt}` : `option ${option}`}`, () => {
				const question = required(document.querySelector<HTMLElement>(`[data-prompt="${prompt}"]`), `question ${prompt}`);
				const parts =
					option === undefined
						? [...question.querySelectorAll<HTMLElement>(":scope > legend, :scope > div:first-of-type")]
						: [required(choice(option).closest<HTMLElement>(".question-choice"), `option ${option}`)];
				function all(selector: string) {
					return parts.flatMap((part) => [...part.querySelectorAll(selector)]);
				}
				const text = parts.map((part) => part.textContent ?? "").join("\n");
				return {
					block: (option === undefined ? question : parts[0])?.textContent ?? "",
					code: all("code").map((element) => element.textContent),
					emphasis: all("strong").map((element) => element.textContent),
					links: all("a").map((link) => `${link.textContent} -> ${link.getAttribute("href")}`),
					list: all("li").map((item) => item.textContent),
					markdownLeft: /\*\*|`/u.test(text),
					text,
				};
			}),
		recordedAnswers: (item: string, request: string) =>
			// The Board registers a question with its first recorded answer, so an unregistered question has no answers yet.
			Effect.tryPromise(() => screenData(engine, tell).readResponses(item, request)).pipe(
				Effect.catchIf(
					({ cause }) => cause instanceof Error && cause.name === "NotFound",
					() => Effect.succeed({ responses: [] }),
				),
				Effect.orDie,
				Effect.map(({ responses }) =>
					responses
						.toSorted((left, right) => left.response.recordedAt - right.response.recordedAt)
						.map(({ body, id, response }) => ({
							answers: response.answers,
							author: response.author,
							body,
							id,
							kind: response.type,
							replaces: response.supersedes,
						})),
				),
			),
		shownGeneratedIds: () =>
			read("the reader looks for generated decision ids in headings, titles, the summary and the location trail", () =>
				[...document.querySelectorAll('h1, h2, [title], .item-summary, [aria-label="File location"]')]
					.map((element) => element.textContent ?? "")
					.filter((text) => /[a-f\d]{64}/u.test(text)),
			),
	};
}
