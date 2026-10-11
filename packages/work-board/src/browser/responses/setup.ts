import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { formOwner } from "#browser/fieldFeedback.ts";
import { authorLabel } from "./authorLabel.ts";
import { draftSession } from "./draftSession.ts";
import { requestAuthor, responseFields } from "./fields.ts";
import { responseForm } from "./form.ts";
import { responsePreview } from "./preview.ts";
import { questionnaireControls } from "./questionnaireControls.ts";
import { submitResponse } from "./submit.ts";

function attach() {
	const doc = document.getElementById("doc");
	if (!doc) {
		return;
	}
	const form = doc.querySelector<HTMLFormElement>("#response-form");
	if (!form || form.dataset.bound === "true") {
		return;
	}
	form.dataset.bound = "true";
	const found = responseFields(form);
	if (!found) {
		return;
	}
	const fields = found;
	const { author, body, clear, preview, previewButton, status, submit, supersedes, type } = fields;
	if (status.textContent?.includes("JavaScript is required")) {
		status.textContent = "Draft ready. Preview the Markdown before recording it.";
	}
	const item = form.dataset.item ?? "";
	const request = form.dataset.request ?? "";
	const revision = form.dataset.revision ?? "";
	const questionId = form.dataset.question ?? "";
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
	const owner = formOwner(form);
	const controls = questionnaireControls(form, owner.signal);
	let recovery = controls.restore(draft, revision);
	if (draft.question && draft.question !== questionId && draft.revision === revision) {
		status.textContent = "Source moved since this draft. Text is retained and selections cleared; review the source and preview before responding.";
	}
	if (supersedes instanceof HTMLSelectElement) {
		supersedes.value = draft.supersedes ?? "";
	}
	const label = authorLabel(storageApi, document.documentElement.dataset.workspace);
	author.value = label.read(draft.author);
	body.value = draft.body;
	type.value = draft.type;
	let pending = draft;
	const { model, sync, valid } = responseForm(form, fields, draft, controls, owner, (values) =>
		submitResponse(form, status, drafts, pending, values),
	);
	function save() {
		const values = sync();
		label.save(values.author);
		draft = drafts.update({
			answers: values.answers,
			author: values.author,
			body: values.body,
			question: draft.question ?? questionId,
			recovery,
			revision: draft.revision,
			supersedes: values.supersedes,
			type: values.type,
		});
		model.change("id", draft.id);
	}
	form.addEventListener(
		"input",
		() => {
			save();
			preview.hidden = true;
			submit.disabled = true;
		},
		{ signal: owner.signal },
	);
	previewButton.disabled = false;
	clear.disabled = false;
	previewButton.addEventListener(
		"click",
		() => {
			requestAuthor(form, status, author);
			save();
			model.change(
				"id",
				draft.revision === revision && (!draft.question || draft.question === questionId) ? drafts.current().id : `response.${crypto.randomUUID()}`,
			);
			model.change("question", questionId);
			model.change("revision", revision);
			draft = drafts.update({ ...model.values.value, recovery });
			preview.textContent = responsePreview(draft, questionId ?? "", controls.models);
			preview.hidden = false;
			submit.disabled = form.dataset.writable !== "true" || !valid();
		},
		{ signal: owner.signal },
	);
	clear.addEventListener("click", drafts.clear, { signal: owner.signal });
	form.addEventListener(
		"submit",
		async (event) => {
			event.preventDefault();
			if (submit.disabled || draft.revision !== revision || draft.question !== questionId || !valid() || !form.reportValidity()) {
				return;
			}
			submit.disabled = true;
			previewButton.disabled = true;
			pending = draft;
			owner.registry.set(model.submit, undefined);
			const cleared = await Effect.runPromise(AtomRegistry.getResult(owner.registry, model.submit, { suspendOnWaiting: true })).catch(() => false);
			if (cleared) {
				draft = drafts.current();
				recovery = draft.recovery;
				if (form.isConnected) {
					model.receive({ ...model.values.value, answers: undefined, body: "", id: draft.id, supersedes: undefined });
					model.revert();
					body.value = model.field("body").value;
					controls.restore(draft, revision);
					if (supersedes instanceof HTMLSelectElement) {
						supersedes.value = "";
					}
				}
			}
			previewButton.disabled = false;
		},
		{ signal: owner.signal },
	);
}
export function setupResponses() {
	document.addEventListener("board-page", attach);
	window.addEventListener("pageshow", attach);
	attach();
}
