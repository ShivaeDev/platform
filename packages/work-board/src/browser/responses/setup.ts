import { draftSession } from "./draftSession.ts";
import { responsePreview } from "./preview.ts";
import { submitResponse } from "./submit.ts";

function attach() {
	const doc = document.getElementById("doc");
	if (doc?.dataset.view !== "response") {
		return;
	}
	const form = doc.querySelector<HTMLFormElement>("#response-form");
	if (!form || form.dataset.bound === "true") {
		return;
	}
	form.dataset.bound = "true";
	const status = form.querySelector<HTMLParagraphElement>("#response-status");
	const author = form.elements.namedItem("author");
	const body = form.elements.namedItem("body");
	const type = form.elements.namedItem("type");
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
		return;
	}
	if (status.textContent?.includes("JavaScript is required")) {
		status.textContent = "Draft ready. Preview the Markdown before recording it.";
	}
	const item = form.dataset.item ?? "";
	const request = form.dataset.request ?? "";
	const revision = form.dataset.revision ?? "";
	const key = `${item}/${request}`;
	const storage = `work-board:drafts:${document.documentElement.dataset.workspace}`;
	let storageApi: Storage | undefined;
	try {
		storageApi = window.localStorage;
	} catch {
		storageApi = undefined;
	}
	const drafts = draftSession(key, revision, storageApi, storage, (message) => {
		status.textContent = message;
	});
	let draft = drafts.current();
	author.value = draft.author;
	body.value = draft.body;
	type.value = draft.type;
	const fields = { author, body, type };
	function save() {
		draft = drafts.update({ author: fields.author.value, body: fields.body.value, revision: draft.revision, type: fields.type.value });
	}
	form.addEventListener("input", () => {
		save();
		preview.hidden = true;
		submit.disabled = true;
	});
	previewButton.disabled = false;
	clear.disabled = false;
	previewButton.addEventListener("click", () => {
		draft = drafts.update({
			author: author.value,
			body: body.value,
			id: draft.revision === revision ? drafts.current().id : `response.${crypto.randomUUID()}`,
			revision,
			type: type.value,
		});
		preview.textContent = responsePreview(draft, form.dataset.question ?? "");
		preview.hidden = false;
		submit.disabled = form.dataset.writable !== "true" || !form.checkValidity();
	});
	clear.addEventListener("click", drafts.clear);
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (submit.disabled || draft.revision !== revision || !form.reportValidity()) {
			return;
		}
		submit.disabled = true;
		previewButton.disabled = true;
		if (await submitResponse(form, status, drafts, draft)) {
			draft = drafts.current();
			if (form.isConnected) {
				body.value = "";
			}
		}
		previewButton.disabled = false;
	});
}
export function setupResponses() {
	document.addEventListener("board-page", attach);
	window.addEventListener("pageshow", attach);
	attach();
}
