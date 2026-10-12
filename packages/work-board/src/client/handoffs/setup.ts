import { Effect, Schema } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { formOwner } from "#client/fieldFeedback.ts";
import { copyPrompts, preparedPrompt } from "#client/handoffs/copy.ts";
import { handoffFields, restoreFields } from "#client/handoffs/fields.ts";
import { draftSession } from "#client/responses/draftSession.ts";
import { session } from "#client/session.ts";
import { PublicationUncertain, ResponseRejection } from "#rpc/rejections.ts";
import { handoffForm } from "./form.ts";

function attach() {
	const doc = document.getElementById("doc");
	if (doc?.dataset.view !== "handoff") {
		return;
	}
	copyPrompts(doc);
	const form = doc.querySelector<HTMLFormElement>("#handoff-form");
	if (!form || form.dataset.bound === "true") {
		return;
	}
	const found = handoffFields(form);
	const status = form.querySelector<HTMLParagraphElement>("#handoff-status");
	const preview = form.querySelector<HTMLPreElement>("#handoff-preview-content");
	const previewButton = form.querySelector<HTMLButtonElement>("#handoff-preview");
	const submit = form.querySelector<HTMLButtonElement>("#handoff-submit");
	const clear = form.querySelector<HTMLButtonElement>("#handoff-clear");
	const prepared = form.querySelector<HTMLElement>("#handoff-prepared");
	if (!(found && status && preview && previewButton && submit && clear && prepared)) {
		return;
	}
	const fields = found;
	form.dataset.bound = "true";
	const revision = form.dataset.revision ?? "";
	const question = form.dataset.question ?? "";
	let storage: Storage | undefined;
	try {
		storage = window.localStorage;
	} catch {
		storage = undefined;
	}
	if (status.textContent?.includes("JavaScript is required")) {
		status.textContent = "Draft ready. Review and preview before preparing the file.";
	}
	const drafts = draftSession(
		`handoff:${form.dataset.item}`,
		revision,
		storage,
		`work-board:drafts:${document.documentElement.dataset.workspace}`,
		(message) => {
			status.textContent = message;
		},
		"handoff",
	);
	let draft = drafts.current();
	restoreFields(fields, draft);
	const owner = formOwner(form);
	let pending = draft;
	const { model, valid } = handoffForm(form, fields, draft, owner, async (input) => {
		const native = session(window);
		const saved = await native.mutate(native.handoffs.prepareHandoff.run(input));
		const cleared = drafts.saved(pending);
		draft = drafts.current();
		if (form.isConnected) {
			status.textContent = `Prepared: ${saved.file}. Receipt: ${saved.handoff.state}; execution and acceptance remain separate.${cleared ? "" : " Your newer draft remains unsaved."}`;
			preparedPrompt(prepared, saved.id, saved.prompt);
		}
		return saved;
	});
	function save() {
		model.change("recipient", fields.recipient.value);
		model.change("constraints", fields.constraints.value);
		model.change("goal", fields.goal.value);
		model.change("nextAction", fields.nextAction.value);
		const values = model.values.value;
		draft = drafts.update({
			author: values.recipient,
			body: JSON.stringify({ constraints: values.constraints, goal: values.goal, nextAction: values.nextAction }),
		});
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
	clear.addEventListener("click", drafts.clear, { signal: owner.signal });
	previewButton.addEventListener(
		"click",
		() => {
			save();
			draft = drafts.update({
				id: draft.revision === revision && (!draft.question || draft.question === question) ? draft.id : `handoff.${crypto.randomUUID()}`,
				question,
				revision,
			});
			model.change("id", draft.id);
			model.change("revision", revision);
			const input = model.values.value;
			preview.textContent = `New file: handoffs/${input.id}.md\nPrepared time and reviewed snapshot are assigned by the server.\n\n---\n${JSON.stringify({ handoff: { constraints: input.constraints, goal: input.goal, item: input.item, "next_action": input.nextAction, recipient: input.recipient, "reviewed_revision": input.revision, source: input.source, state: "requested" }, id: input.id, kind: "handoff" }, null, 2)}\n---\nThe complete reviewed source is preserved below the frontmatter.`;
			preview.hidden = false;
			submit.disabled = form.dataset.writable !== "true" || !valid();
		},
		{ signal: owner.signal },
	);
	form.addEventListener(
		"submit",
		async (event) => {
			event.preventDefault();
			if (submit.disabled || !valid() || !form.reportValidity()) {
				return;
			}
			pending = draft;
			submit.disabled = true;
			previewButton.disabled = true;
			status.textContent = "Pending: preparing the local handoff file…";
			owner.registry.set(model.submit, undefined);
			try {
				await Effect.runPromise(AtomRegistry.getResult(owner.registry, model.submit, { suspendOnWaiting: true }));
			} catch (error) {
				if (form.isConnected) {
					status.textContent = failureStatus(error);
				}
			}
			previewButton.disabled = false;
		},
		{ signal: owner.signal },
	);
}
function failureStatus(error: unknown) {
	return `${Schema.is(ResponseRejection)(error) && !(error instanceof PublicationUncertain) && !(error instanceof InternalServerError) ? "Rejected" : "Uncertain"}: ${String(error)}. Draft retained; preview and retry.`;
}
export function setupHandoffs() {
	document.addEventListener("board-page", attach);
	window.addEventListener("pageshow", attach);
	attach();
}
