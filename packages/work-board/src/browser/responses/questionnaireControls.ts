import type { Draft } from "./drafts.ts";
import type { Prompt } from "./Prompt.ts";
import type { PromptAnswer } from "./schema.ts";

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
export function questionnaireControls(form: HTMLFormElement) {
	function modeOf(field: HTMLFieldSetElement) {
		if (field.dataset.mode === "text") {
			return "text";
		}
		return field.dataset.mode === "many" ? "many" : "one";
	}
	const fields = [...form.querySelectorAll<HTMLFieldSetElement>("fieldset[data-prompt]")];
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
	function validate(type: string) {
		for (const field of fields) {
			const text = field.querySelector<HTMLTextAreaElement>("textarea");
			text?.setCustomValidity(
				type === "answer" && !text.value.trim() && !field.querySelector("input:checked") ? "Choose an option or answer in your own words." : "",
			);
		}
	}
	for (const field of fields) {
		field.querySelector("[data-clear-choices]")?.addEventListener("click", () => {
			for (const input of field.querySelectorAll<HTMLInputElement>("input")) {
				input.checked = false;
			}
			form.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}
	return { models, read, restore, validate };
}
