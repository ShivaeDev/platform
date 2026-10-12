import { Effect, Equal } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { formOwner } from "#client/fieldFeedback.ts";
import { restoreFocus } from "#client/formFocus.ts";
import { responseBinding, retainResponseBinding } from "./binding.ts";
import { responseFeedback } from "./feedback.ts";
import { responseFields } from "./fields.ts";
import { responseForm } from "./form.ts";
import { responsePreview } from "./preview.ts";
import { questionnaireControls } from "./questionnaireControls.ts";
import { submitResponse } from "./submit.ts";

export function attachResponses() {
	const form = document.getElementById("doc")?.querySelector<HTMLFormElement>("#response-form");
	if (!form) {
		return;
	}
	const selection = responseBinding(form);
	if (form.dataset.bound === "true") {
		return;
	}
	const fields = responseFields(form);
	if (!fields) {
		return;
	}
	form.dataset.bound = "true";
	const { clear, preview, previewButton, status, submit } = fields;
	preview.hidden = true;
	submit.disabled = true;
	const revision = form.dataset.revision ?? "";
	const question = form.dataset.question ?? "";
	const owner = formOwner(form);
	retainResponseBinding(form, owner.release);
	const controls = questionnaireControls(form, owner.signal);
	const { model, restore, sync, valid } = responseForm(form, fields, controls, owner, (values) => submitResponse(form, status, values));
	const draft = model.values.value;
	let notice =
		draft.id && (draft.revision !== revision || draft.question !== question)
			? "Source changed since this draft. Your text is retained; review the new source and preview to bind it to this revision."
			: "";
	const feedback = responseFeedback(form, fields, valid);
	feedback.show(notice);
	function changed() {
		sync();
		preview.hidden = true;
		submit.disabled = true;
		feedback.show(notice);
	}
	form.addEventListener("input", changed, { signal: owner.signal });
	previewButton.disabled = false;
	clear.disabled = false;
	previewButton.addEventListener(
		"click",
		() => {
			sync();
			const current = model.values.value;
			if (current.revision !== revision || current.question !== question) {
				model.change("id", `response.${crypto.randomUUID()}`);
			}
			model.change("question", question);
			model.change("revision", revision);
			notice = "";
			preview.textContent = responsePreview(model.values.value, question, controls.models);
			preview.hidden = false;
			submit.disabled = form.dataset.writable !== "true" || !feedback.show(notice, true);
		},
		{ signal: owner.signal },
	);
	clear.addEventListener(
		"click",
		() => {
			model.revert();
			restore();
			notice = "";
			preview.hidden = true;
			submit.disabled = true;
			feedback.show("Draft cleared. Saved responses are unchanged.");
		},
		{ signal: owner.signal },
	);
	form.addEventListener(
		"submit",
		async (event) => {
			event.preventDefault();
			sync();
			if (!feedback.show(notice, true)) {
				feedback.focus();
				return;
			}
			const pending = model.values.value;
			if (submit.disabled || pending.revision !== revision || pending.question !== question) {
				status.textContent = "Preview the current draft before recording. Your text is retained.";
				return;
			}
			submit.disabled = true;
			previewButton.disabled = true;
			owner.registry.set(model.submit, undefined);
			try {
				await Effect.runPromise(AtomRegistry.getResult(owner.registry, model.submit, { suspendOnWaiting: true }));
				const newer = !Equal.equals(model.values.value, pending);
				model.receive({
					...pending,
					answers: undefined,
					body: "",
					id: "",
					question: "",
					recovery: undefined,
					revision: "",
					supersedes: undefined,
				});
				if (newer) {
					model.change("id", `response.${crypto.randomUUID()}`);
					model.change("question", question);
					model.change("revision", revision);
					if (form.isConnected) {
						status.textContent += " Your current draft remains unsaved.";
					}
				}
				if (form.isConnected) {
					restore();
				}
			} catch {
				// Submission status is rendered by submitResponse.
			}
			previewButton.disabled = false;
		},
		{ signal: owner.signal },
	);
	restoreFocus(form, selection);
}
