import { Effect } from "effect";
import { escapeHtml } from "#browser/escapeHtml.ts";
import { optionLabel } from "#browser/responses/cardContext.ts";
import { RenderFailed } from "#render/failed.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { renderMarkdown } from "#server/render/markdown.ts";
import { optionControls } from "./optionControls.ts";
import { questionTemplate } from "./template.ts";

export const templateHtml = Effect.fn("WorkBoard.templateHtml")(function* (context: string, request: string, file: string) {
	const template = yield* Effect.try({ catch: (cause) => new RenderFailed({ cause }), try: () => questionTemplate(context, request, file) });
	function render(source: string) {
		return renderMarkdown(source, { file, safe: true });
	}
	const background = yield* render(template.context);
	const fields = metadataParse(context).fields;
	const choicePrompt = fields.options !== undefined && !fields.question ? template.prompts.at(0) : undefined;
	if (choicePrompt) {
		return { background, controls: optionControls(choicePrompt, fields), hasPrompts: true };
	}
	const controls = yield* Effect.forEach(template.prompts, (prompt, index) =>
		Effect.gen(function* () {
			const description = yield* render(prompt.source);
			const options = yield* Effect.forEach(prompt.options, (option, choice) =>
				Effect.map(
					render(option.source),
					(html) =>
						`<div class="question-option"><input id="question-${index}-${choice}" type="${prompt.mode === "one" ? "radio" : "checkbox"}" name="choice-${escapeHtml(prompt.id)}" value="${escapeHtml(option.id)}" data-option-source="${escapeHtml(option.source)}"><div><label for="question-${index}-${choice}">${escapeHtml(optionLabel(option.id, option.source, context))}</label>${html}</div></div>`,
				),
			);
			return `<fieldset data-prompt="${escapeHtml(prompt.id)}" data-mode="${prompt.mode}" data-source="${escapeHtml(prompt.source)}"><legend>Question ${index + 1} · ${escapeHtml(prompt.id)}</legend>${description}<p>${prompt.mode === "text" ? "Answer in your own words" : `${prompt.mode === "one" ? "Choose one option" : "Choose any combination"}, or answer in your own words`}. Nothing is selected for you.</p>${options.join("")}${prompt.mode === "text" ? "" : '<button type="button" data-clear-choices>Clear selections</button>'}<label>Additional text / another answer<textarea data-answer-text maxlength="8192" rows="3"></textarea></label></fieldset>`;
		}),
	);
	return { background, controls: controls.join(""), hasPrompts: template.prompts.length > 0 };
});
