import { Effect } from "effect";
import { loadQuery } from "@shivaedev/react/adapters/loadQuery.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { setNativeValue } from "./setNativeValue.ts";
import { shellActs, shellElement } from "./shellScreenAct.ts";

const FORM = "#response-form";

function handoffInput(label: string) {
	const found = [...document.querySelectorAll<HTMLLabelElement>("#handoff-form label")].find((candidate) => candidate.textContent === label);
	const field = found ? document.getElementById(found.htmlFor) : null;
	return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field : undefined;
}

export function shellFormVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { acting, reading } = shellActs(engine, tell);
	return {
		answerForm: () =>
			reading("the reader reads how the answer form is laid out", () => {
				const form = shellElement(FORM, "answer form");
				function asked(name: string) {
					return form.querySelector(`[name="${name}"]`) ? "asked" : "not asked";
				}
				return {
					author: asked("author"),
					details: form.querySelector<HTMLDetailsElement>('[data-key="response-details"]')?.open ? "open" : "closed",
					item: form.getAttribute("data-item"),
					promptsShown: [...form.querySelectorAll("textarea")]
						.filter((field) => !field.closest("details"))
						.map((field) => field.closest("[data-prompt]")?.getAttribute("data-prompt")),
					supersedes: asked("supersedes"),
					type: form.querySelector('[name="type"]')?.closest('details[data-key="response-details"]') ? "under details" : "shown",
				};
			}),
		answerSaveStatus: () => reading("the reader reads whether the answer was saved", () => document.querySelector("#response-status")?.textContent),
		chooseAnswerOption: (choice: string) =>
			acting(`the reader chooses ${choice} in the answer form`, () => shellElement(`[data-choice='${choice}']`, `answer choice ${choice}`).click()),
		handoffText: (label: string) => reading(`the reader reads the handoff's ${label}`, () => handoffInput(label)?.value ?? "no handoff form"),
		savedAnswerAuthors: (item: string, request: string) =>
			Effect.promise(async () => {
				tell(`the reader reads who wrote the saved answers to ${item}/${request}`);
				if (!(engine.api && engine.view)) {
					throw new Error("The Board screen has not opened");
				}
				const { api } = engine;
				const { registry } = engine.view;
				const options = { abortController: new AbortController() };
				const question = await loadQuery(registry, api.forms.responses.question.query({ item, request }), options);
				const query = api.forms.responses.responses.query({ question: question.id });
				registry.refresh(query);
				return (await loadQuery(registry, query, options)).responses.map((entry) => entry.response.author);
			}),
		submitAnswer: () => acting("the reader submits the answer", () => shellElement("#response-submit", "Submit button").click()),
		writeInHandoff: (label: string, text: string) =>
			acting(`the reader writes ${JSON.stringify(text)} as the handoff's ${label}`, () => {
				const field = handoffInput(label);
				if (!field) {
					throw new Error(`The page has no handoff field labelled ${label}`);
				}
				setNativeValue(field, text);
				field.dispatchEvent(new Event("input", { bubbles: true }));
			}),
	};
}
