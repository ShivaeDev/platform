import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { formOwner } from "#client/fieldFeedback.ts";
import { restoreFocus } from "#client/formFocus.ts";
import { responseBinding, retainResponseBinding } from "./binding.ts";
import { responseDraft } from "./draft.ts";
import { responseFeedback } from "./feedback.ts";
import { responseFields } from "./fields.ts";
import { responseForm } from "./form.ts";
import { responsePreview } from "./preview.ts";
import { questionnaireControls } from "./questionnaireControls.ts";
import { submitResponse } from "./submit.ts";

export function attachResponses() {
	const doc = document.getElementById("doc");
	if (!doc) {
		return;
	}
	const form = doc.querySelector<HTMLFormElement>("#response-form");
	if (!form) {
		return;
	}
	const selection = responseBinding(form);
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
	const revision = form.dataset.revision ?? "";
	const questionId = form.dataset.question ?? "";
	let notice = "";
	const { drafts, label } = responseDraft(form, (message) => {
		notice = message;
		status.textContent = message;
	});
	let draft = drafts.current();
	const owner = formOwner(form);
	retainResponseBinding(form, owner.release);
	const controls = questionnaireControls(form, owner.signal);
	let recovery = controls.restore(draft, revision);
	if (draft.question && draft.question !== questionId && draft.revision === revision) {
		notice = "Source moved since this draft. Text is retained and selections cleared; review the source and preview before responding.";
		status.textContent = notice;
	}
	if (supersedes instanceof HTMLSelectElement) {
		supersedes.value = draft.supersedes ?? "";
	}
	author.value = label.read(draft.author);
	body.value = draft.body;
	type.value = draft.type;
	let pending = draft;
	const { model, sync, valid } = responseForm(form, fields, draft, controls, owner, (values) =>
		submitResponse(form, status, drafts, pending, values),
	);
	const feedback = responseFeedback(form, fields, valid);
	feedback.show(notice);
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
			feedback.show(notice);
		},
		{ signal: owner.signal },
	);
	previewButton.disabled = false;
	clear.disabled = false;
	previewButton.addEventListener(
		"click",
		() => {
			save();
			if (notice.startsWith("Source ")) {
				notice = "";
			}
			model.change(
				"id",
				draft.revision === revision && (!draft.question || draft.question === questionId) ? drafts.current().id : `response.${crypto.randomUUID()}`,
			);
			model.change("question", questionId);
			model.change("revision", revision);
			draft = drafts.update({ ...model.values.value, recovery });
			preview.textContent = responsePreview(draft, questionId ?? "", controls.models);
			preview.hidden = false;
			const ready = feedback.show(notice, true);
			submit.disabled = form.dataset.writable !== "true" || !ready;
		},
		{ signal: owner.signal },
	);
	clear.addEventListener("click", drafts.clear, { signal: owner.signal });
	form.addEventListener(
		"submit",
		async (event) => {
			event.preventDefault();
			sync();
			if (!feedback.show(notice, true)) {
				feedback.focus();
				return;
			}
			if (submit.disabled || draft.revision !== revision || draft.question !== questionId) {
				status.textContent = "Preview the current draft before recording. Your text is retained.";
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
	restoreFocus(form, selection);
}
