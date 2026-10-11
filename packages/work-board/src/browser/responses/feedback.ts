import type { responseFields } from "./fields.ts";

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function promptName(prompt: HTMLFieldSetElement) {
	return prompt.querySelector("legend")?.textContent ?? "Question";
}
function unanswered(prompt: HTMLFieldSetElement) {
	return !(prompt.querySelector("input:checked") || prompt.querySelector<HTMLTextAreaElement>("textarea")?.value.trim());
}
function errorFor(control: Control, author: HTMLInputElement, missing: readonly HTMLFieldSetElement[]) {
	if (control === author && !author.value.trim()) {
		return "Add your local author label.";
	}
	const prompt = control.closest("fieldset");
	if (prompt && missing.includes(prompt)) {
		return `Unanswered: ${promptName(prompt)}. Choose an option or answer in your own words.`;
	}
	return control.validationMessage;
}
function displayError(control: Control, message: HTMLElement, error: string) {
	message.textContent = error;
	message.hidden = !error;
	control.setAttribute("aria-invalid", String(Boolean(error)));
	if (error) {
		control.closest("details")?.setAttribute("open", "");
	}
}
function messageFor(control: Control, index: number) {
	const existing = control.nextElementSibling;
	const message = existing instanceof HTMLElement && existing.classList.contains("response-field-error") ? existing : document.createElement("span");
	message.id = `response-error-${index}`;
	message.className = "response-field-error";
	message.hidden = true;
	control.after(message);
	control.setAttribute("aria-describedby", message.id);
	return { control, message };
}
function readyMessage(decoded: boolean, previewed: boolean) {
	if (!decoded) {
		return "This draft is invalid. Review the response fields before recording.";
	}
	return previewed ? "Preview ready. Record this response when you are ready." : "Draft ready. Preview the Markdown before recording it.";
}

export function responseFeedback(form: HTMLFormElement, fields: NonNullable<ReturnType<typeof responseFields>>, valid: () => boolean) {
	const { author, body, status, supersedes, type } = fields;
	const prompts = [...form.querySelectorAll<HTMLFieldSetElement>("fieldset[data-prompt]")];
	const controls: readonly Control[] = [
		author,
		body,
		type,
		...(supersedes instanceof HTMLSelectElement ? [supersedes] : []),
		...prompts.flatMap((prompt) => [...prompt.querySelectorAll<HTMLTextAreaElement>("textarea")]),
	];
	const messages = controls.map(messageFor);
	function show(notice: string, previewed = false) {
		const decoded = valid();
		const missing = type.value === "answer" ? prompts.filter(unanswered) : [];
		for (const { control, message } of messages) {
			displayError(control, message, errorFor(control, author, missing));
		}
		const errors = messages.filter(({ message }) => !message.hidden);
		const summary = [
			author.value.trim() ? "" : "Add your local author label.",
			missing.length > 0 ? `Unanswered prompts: ${missing.map(promptName).join("; ")}.` : "",
			...errors.filter(({ control }) => control !== author && !control.closest("fieldset")).map(({ message }) => message.textContent),
		]
			.filter(Boolean)
			.join(" ");
		if (form.dataset.writable === "true" && status.dataset.outcome !== "pending") {
			delete status.dataset.outcome;
			status.textContent = [notice, summary || readyMessage(decoded, previewed)].filter(Boolean).join(" ");
		}
		return decoded && errors.length === 0;
	}
	function focus() {
		messages.find(({ message }) => !message.hidden)?.control.focus();
	}
	return { focus, show };
}
