import { Effect } from "effect";
import { escapeHtml } from "#page/escape.ts";
import { renderMarkdown } from "#render/markdown.ts";
import { questionTemplate } from "./template.ts";

export const templateHtml = Effect.fn("WorkBoard.templateHtml")(function* (context: string, request: string, file: string) {
	const template = questionTemplate(context, request, file);
	function render(source: string) {
		return renderMarkdown(source, { file, safe: true });
	}
	const background = yield* render(template.context);
	const controls = yield* Effect.forEach(template.prompts, (prompt, index) =>
		Effect.gen(function* () {
			const description = yield* render(prompt.source);
			const options = yield* Effect.forEach(prompt.options, (option, choice) =>
				Effect.map(
					render(option.source),
					(html) =>
						`<div class="question-option"><input id="question-${index}-${choice}" type="${prompt.mode === "one" ? "radio" : "checkbox"}" name="choice-${escapeHtml(prompt.id)}" value="${escapeHtml(option.id)}" data-option-source="${escapeHtml(option.source)}"><div><label for="question-${index}-${choice}">Option ${escapeHtml(option.id)}</label>${html}</div></div>`,
				),
			);
			return `<fieldset data-prompt="${escapeHtml(prompt.id)}" data-mode="${prompt.mode}" data-source="${escapeHtml(prompt.source)}"><legend>Question ${index + 1} · ${escapeHtml(prompt.id)}</legend>${description}<p>${prompt.mode === "text" ? "Answer in your own words" : `${prompt.mode === "one" ? "Choose one option" : "Choose any combination"}, or answer in your own words`}. Nothing is selected for you.</p>${options.join("")}${prompt.mode === "text" ? "" : '<button type="button" data-clear-choices>Clear selections</button>'}<label>Additional text / another answer<textarea data-answer-text maxlength="8192" rows="3"></textarea></label></fieldset>`;
		}),
	);
	return { background, controls: controls.join(""), hasPrompts: template.prompts.length > 0 };
});
