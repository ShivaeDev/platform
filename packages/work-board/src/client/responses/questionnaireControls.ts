import type { Prompt } from "#browser/responses/Prompt.ts";
import type { PromptAnswer } from "#browser/responses/schema.ts";
import type { Draft } from "./drafts.ts";

function restoreAnswers(fields: readonly HTMLFieldSetElement[], draft: Draft, same: boolean) {
	for (const field of fields) {
		const answer = draft.answers?.find((entry) => entry.prompt === field.dataset.prompt);
		for (const input of field.querySelectorAll<HTMLInputElement>("input")) {
			input.checked = same && (answer?.selected.includes(input.value) ?? false);
		}
		const text = field.querySelector<HTMLTextAreaElement>("textarea");
		if (text) {
			text.value = answer?.text ?? "";
		}
	}
}
export function questionnaireControls(form: HTMLFormElement, signal: AbortSignal) {
	function modeOf(field: HTMLFieldSetElement) {
		if (field.dataset.mode === "text") {
			return "text";
		}
		return field.dataset.mode === "many" ? "many" : "one";
	}
	const fields = [...form.querySelectorAll<HTMLFieldSetElement>("fieldset[data-prompt]")];
	function syncChoices() {
		for (const button of form.querySelectorAll<HTMLButtonElement>("button[data-choice]")) {
			const input = form.querySelector<HTMLInputElement>(`input[value="${button.dataset.choice}"]`);
			button.setAttribute("aria-pressed", String(input?.checked ?? false));
		}
	}
	form.addEventListener(
		"click",
		(event) => {
			const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-choice]") : null;
			if (!button) {
				return;
			}
			const input = form.querySelector<HTMLInputElement>(`input[value="${button.dataset.choice}"]`);
			if (input) {
				input.checked = true;
				syncChoices();
				input.dispatchEvent(new Event("input", { bubbles: true }));
			}
		},
		{ signal },
	);
	form.addEventListener("input", syncChoices, { signal });
	const models: Prompt[] = fields.map((field) => ({
		id: field.dataset.prompt ?? "",
		mode: modeOf(field),
		options: [...field.querySelectorAll<HTMLInputElement>("input[data-option-source]")].map((input) => ({
			id: input.value,
			source: input.dataset.optionSource ?? "",
		})),
		source: field.dataset.source ?? "",
	}));
	function read(): readonly PromptAnswer[] | undefined {
		return fields.length === 0
			? undefined
			: fields.map((field) => ({
					prompt: field.dataset.prompt ?? "",
					selected: [...field.querySelectorAll<HTMLInputElement>("input:checked")].map((input) => input.value),
					text: field.querySelector<HTMLTextAreaElement>("textarea")?.value ?? "",
				}));
	}
	function restore(draft: Draft, revision: string) {
		const same = draft.revision === revision && (draft.question === undefined || draft.question === form.dataset.question);
		restoreAnswers(fields, draft, same);
		syncChoices();
		const recovery = form.querySelector<HTMLPreElement>("#response-draft-recovery");
		const retained =
			!same && draft.answers
				? `Earlier template answers (selections cleared; review before choosing again):\n${JSON.stringify(draft.answers, null, 2)}\n${draft.recovery ?? ""}`
				: draft.recovery;
		if (recovery) {
			recovery.textContent = retained ?? "";
			recovery.hidden = !retained;
		}
		return retained;
	}
	for (const field of fields) {
		field.querySelector("[data-clear-choices]")?.addEventListener(
			"click",
			() => {
				for (const input of field.querySelectorAll<HTMLInputElement>("input")) {
					input.checked = false;
				}
				form.dispatchEvent(new Event("input", { bubbles: true }));
			},
			{ signal },
		);
	}
	return { models, read, restore };
}
