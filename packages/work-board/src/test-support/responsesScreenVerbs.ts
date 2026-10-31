import { act } from "react";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { loadQuery } from "@shivaedev/react/adapters/loadQuery.ts";
import { documentQuery, navigationQuery, routeQueryOptions } from "#client/react/routeQuery.ts";
import { control } from "./chrome.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { readoutVerbs, settlingVerbs } from "./screenSettle.ts";

function all(selector: string, within: ParentNode = document) {
	return [...within.querySelectorAll<HTMLElement>(selector)];
}

function text(selector: string) {
	return document.querySelector(selector)?.textContent?.trim();
}

function card(request: string) {
	return document.getElementById(`answer-card-${request}`);
}

function promptField(prompt: string) {
	const field = document.querySelector(`[data-prompt="${prompt}"] textarea`);
	if (!(field instanceof HTMLTextAreaElement)) {
		throw new Error(`The packet has no text field for prompt ${prompt}`);
	}
	return field;
}

export function responsesScreenVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	function client() {
		if (!(engine.api && engine.view)) {
			throw new Error("The Board screen has not opened");
		}
		return { api: engine.api, registry: engine.view.registry };
	}
	async function recorded(item: string, request: string) {
		const { api, registry } = client();
		const options = { abortController: new AbortController() };
		const preview = await loadQuery(registry, api.forms.responses.question.query({ item, request }), options);
		const query = api.forms.responses.responses.query({ question: preview.id });
		registry.refresh(query);
		return loadQuery(registry, query, options).then(
			(reading) => reading.responses,
			(error: unknown) => {
				if (error instanceof NotFound) {
					return "question not registered" as const;
				}
				throw error;
			},
		);
	}
	const actions = {
		changeSource: async (file: string, source: string) => {
			tell(`an editor changes ${file} and the reader's screen refreshes it`);
			Object.assign(engine.files, { [file]: source });
			const { api, registry } = client();
			const url = engine.router?.state.location.href ?? engine.path;
			await act(() =>
				Promise.resolve().then(() => {
					registry.refresh(api.inbox.query(undefined, routeQueryOptions));
					registry.refresh(api.goals.query(undefined, routeQueryOptions));
					registry.refresh(documentQuery(api, url));
					registry.refresh(navigationQuery(api));
				}),
			);
		},
		previewPacket: async () => {
			tell("the reader previews the answer packet");
			const button = control("#response-preview", HTMLElement);
			await act(async () => button.click());
		},
		sendPacket: () => {
			tell("the reader sends the answer packet");
			const form = control("#response-form", HTMLFormElement);
			act(() => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
		},
	};
	const readouts = {
		activeGoalIds: () => {
			tell("the reader reads the goals listed as active on the Goals page");
			return all("main [data-goal-id]")
				.filter((goal) => goal.closest("details") === null)
				.map((goal) => goal.getAttribute("data-goal-id"));
		},
		answerCardIds: () => {
			tell("the reader reads which answer cards the item offers");
			return all('[id^="answer-card-"]').map((answerCard) => answerCard.id);
		},
		answeredOnToday: (item: string) => {
			tell(`the reader reads how Today describes the answered ${item}`);
			return document.querySelector(`[data-answered-id="${item}"] p`)?.getAttribute("title") ?? "not listed";
		},
		deferredGoalSection: () => {
			tell("the reader reads the folded section of deferred goals on the Goals page");
			const section = document.querySelector("main details");
			return section
				? {
						goals: all("[data-goal-id]", section).map((goal) => goal.getAttribute("data-goal-id")),
						heading: section.querySelector("summary")?.textContent,
					}
				: "absent";
		},
		duplicateCardIds: () => {
			tell("the reader checks the answer cards for element IDs used twice");
			const ids = all(".answer-cards [id]").map((element) => element.id);
			return ids.filter((id, index) => ids.indexOf(id) !== index);
		},
		focusedPrompt: () => {
			tell("the reader checks which prompt holds keyboard focus");
			return document.activeElement?.closest("[data-prompt]")?.getAttribute("data-prompt") ?? "none";
		},
		foreignPacketMarkup: () => {
			tell("the reader looks for authored form and script markup in the live answer form");
			const form = control("#response-form", HTMLFormElement);
			return [
				...all("form, script", form).map((element) => `${element.tagName.toLowerCase()} element`),
				...((form.textContent ?? "").includes("<form") ? ["form markup as text"] : []),
				...((form.textContent ?? "").includes("authoredPacketRan") ? ["script source as text"] : []),
				...("authoredPacketRan" in globalThis ? ["the script ran"] : []),
			];
		},
		goalsPageSummary: () => {
			tell("the reader reads the Goals page summary");
			return text("[data-page-summary]");
		},
		inboxBadge: () => {
			tell("the reader reads the Inbox badge");
			return text("#inbox-count");
		},
		itemTitle: () => {
			tell("the reader reads the item's title");
			return text("#doc h1");
		},
		laterSection: () => {
			tell("the reader reads the Later section on Today");
			const section = document.getElementById("later");
			if (!section) {
				return "absent";
			}
			return {
				folded: section.querySelector("details")?.open === false,
				heading: section.querySelector("summary")?.textContent,
				items: all("li", section).map((item) => item.textContent?.trim()),
			};
		},
		needsYouItems: () => {
			tell("the reader reads the items listed under Needs you");
			return all('ul[aria-label="Needs you"] [data-attention-id]').map((row) => row.getAttribute("data-attention-id"));
		},
		needsYouSection: () => {
			tell("the reader reads the Needs you section on Today");
			return text("#needs-you");
		},
		outcomeAnswer: (id: string) => {
			tell(`the reader reads the recorded answer ${id} on the item`);
			return text(`[data-outcome-answer="${id}"]`) ?? "not shown";
		},
		packetChoice: (option: string) => {
			tell(`the reader checks whether option ${option} is chosen`);
			const choice = document.querySelector(`[data-choice="${option}"]`);
			if (!choice) {
				throw new Error(`The packet has no option ${option}`);
			}
			return choice.getAttribute("aria-checked") === "true" ? "chosen" : "not chosen";
		},
		packetControls: (request: string) => {
			tell(`the reader looks for form controls in the ${request} answer card`);
			return all("form, input, textarea, select, button", card(request) ?? document.createElement("div")).map((element) =>
				element.tagName.toLowerCase(),
			);
		},
		packetHistory: () => {
			tell("the reader reads the response history beside the packet");
			return text("#response-history");
		},
		packetNotice: (request: string) => {
			tell(`the reader reads the status notes in the ${request} answer card`);
			return all('[role="status"]', card(request) ?? document.createElement("div")).map((status) => status.textContent);
		},
		packetPrompts: (request: string) => {
			tell(`the reader reads the questions in the ${request} answer card`);
			return all("[data-prompt]", card(request) ?? document.createElement("div")).map((prompt) => prompt.querySelector("legend, h3")?.textContent);
		},
		packetStatus: () => {
			tell("the reader reads the packet's status line");
			return text("#response-status");
		},
		promptError: (prompt: string) => {
			tell(`the reader reads the error shown beside prompt ${prompt}`);
			return document.querySelector(`[data-prompt="${prompt}"] .response-field-error`)?.textContent?.trim() || "none";
		},
		promptText: (prompt: string) => {
			tell(`the reader reads the text typed for prompt ${prompt}`);
			return promptField(prompt).value;
		},
		promptWarnings: () => {
			tell("the reader reads the browser warning on each prompt's text field");
			return Object.fromEntries(
				all("[data-prompt]")
					.filter((prompt) => prompt.querySelector("textarea"))
					.map((prompt) => [prompt.dataset.prompt ?? "", prompt.querySelector("textarea")?.validationMessage ?? ""]),
			);
		},
		readableOptions: () => {
			tell("the reader reads the questionnaire's options in the document");
			return all(".questionnaire-option").map((option) => option.textContent?.trim());
		},
		readableQuestions: () => {
			tell("the reader reads the questionnaire's questions in the document");
			return all(".questionnaire-question h3").map((heading) => heading.textContent);
		},
		recordedPacketAnswers: async (item: string, request: string) => {
			tell(`the reader reads the answers recorded for ${item}/${request}`);
			const responses = await recorded(item, request);
			return typeof responses === "string" ? responses : responses.map(({ response }) => response.answers);
		},
		recordedPacketAuthors: async (item: string, request: string) => {
			tell(`the reader reads who recorded the answers to ${item}/${request}`);
			const responses = await recorded(item, request);
			return typeof responses === "string" ? responses : responses.map(({ response }) => response.author);
		},
		responsePanel: () => {
			tell("the reader reads the response panel");
			return text(".response-panel");
		},
		selectionMode: (request: string) => {
			tell(`the reader reads whether the ${request} answer card takes one or many options`);
			return card(request)?.querySelector("fieldset[data-mode]")?.getAttribute("data-mode");
		},
		todayAnswerLinks: () => {
			tell("the reader reads where Today's attention rows link");
			return all("[data-attention-row] a[title]").map((link) => link.getAttribute("href"));
		},
		todayGoalIds: () => {
			tell("the reader reads the active goals on Today");
			return all("#today-goals [data-goal-id]").map((goal) => goal.getAttribute("data-goal-id"));
		},
		todayStripText: () => {
			tell("the reader reads Today's summary strip");
			return text(".today-strip");
		},
	};
	return {
		...settlingVerbs(engine, actions),
		...readoutVerbs(engine, readouts),
	};
}
