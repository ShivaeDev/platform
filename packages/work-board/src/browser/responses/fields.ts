export function responseFields(form: HTMLFormElement) {
	const status = form.querySelector<HTMLParagraphElement>("#response-status");
	const author = form.elements.namedItem("author");
	const body = form.elements.namedItem("body");
	const type = form.elements.namedItem("type");
	const supersedes = form.elements.namedItem("supersedes");
	const submit = form.querySelector<HTMLButtonElement>("#response-submit");
	const preview = form.querySelector<HTMLPreElement>("#response-preview-content");
	const clear = form.querySelector<HTMLButtonElement>("#response-clear");
	const previewButton = form.querySelector<HTMLButtonElement>("#response-preview");
	if (
		!(
			status
			&& author instanceof HTMLInputElement
			&& body instanceof HTMLTextAreaElement
			&& type instanceof HTMLSelectElement
			&& submit
			&& preview
			&& clear
			&& previewButton
		)
	) {
		return undefined;
	}
	return { author, body, clear, preview, previewButton, status, submit, supersedes, type };
}
