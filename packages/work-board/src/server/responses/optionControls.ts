import { escapeHtml } from "#browser/escapeHtml.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import type { Metadata } from "#metadata/schema.ts";

export function optionControls(prompt: Prompt, fields: Metadata): string {
	const options = prompt.options
		.map((option, index) => {
			const source = fields.options?.[index];
			return `<input type="radio" name="choice-answer" value="${option.id}" data-option-source="${escapeHtml(option.source)}" hidden><button type="button" class="question-choice" data-choice="${option.id}" aria-pressed="false"><strong>${escapeHtml(source?.label ?? "")}${source?.label === fields.recommended ? " · Recommended" : ""}</strong><small>${escapeHtml(source?.description ?? "")}</small></button>`;
		})
		.join("");
	return `<fieldset data-prompt="answer" data-mode="one" data-source="${escapeHtml(prompt.source)}"><legend>Your answer</legend><p>Choose an option or write another answer. Nothing is selected for you.</p><div class="question-choices">${options}</div><button type="button" data-clear-choices>Clear selection</button><label>Another answer / additional text<textarea data-answer-text maxlength="8192" rows="4"></textarea></label></fieldset>`;
}
