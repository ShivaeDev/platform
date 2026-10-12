import { Effect, Equal, Schema } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { formOwner } from "#client/fieldFeedback.ts";
import { copyPrompts, preparedPrompt } from "#client/handoffs/copy.ts";
import { handoffFields } from "#client/handoffs/fields.ts";
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
	if (status.textContent?.includes("JavaScript is required")) {
		status.textContent = "Draft ready. Review and preview before preparing the file.";
	}
	const owner = formOwner(form);
	const { model, restore, valid } = handoffForm(form, fields, owner, async (input) => {
		const native = session(window);
		const saved = await native.mutate(native.handoffs.prepareHandoff.run(input));
		if (form.isConnected) {
			status.textContent = `Prepared: ${saved.file}. Receipt: ${saved.handoff.state}; execution and acceptance remain separate.`;
			preparedPrompt(prepared, saved.id, saved.prompt);
		}
		return saved;
	});
	if (model.values.value.id && model.values.value.revision !== revision) {
		status.textContent = "Source changed since this draft. Your text is retained; review the new source and preview to bind it to this revision.";
	}

	function save() {
		model.change("recipient", fields.recipient.value);
		model.change("constraints", fields.constraints.value);
		model.change("goal", fields.goal.value);
		model.change("nextAction", fields.nextAction.value);
		if (!model.values.value.id) {
			model.change("id", `handoff.${crypto.randomUUID()}`);
			model.change("revision", revision);
		}
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
	clear.addEventListener(
		"click",
		() => {
			model.revert();
			restore();
			preview.hidden = true;
			submit.disabled = true;
			status.textContent = "Draft cleared. Saved handoffs are unchanged.";
		},
		{ signal: owner.signal },
	);
	previewButton.addEventListener(
		"click",
		() => {
			save();
			if (model.values.value.revision !== revision) {
				model.change("id", `handoff.${crypto.randomUUID()}`);
			}
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
			submit.disabled = true;
			previewButton.disabled = true;
			status.textContent = "Pending: preparing the local handoff file…";
			const pending = model.values.value;
			owner.registry.set(model.submit, undefined);
			try {
				await Effect.runPromise(AtomRegistry.getResult(owner.registry, model.submit, { suspendOnWaiting: true }));
				const newer = !Equal.equals(model.values.value, pending);
				model.receive({ ...pending, constraints: "", goal: "", id: "", nextAction: "", recipient: "", revision: "" });
				if (form.isConnected) {
					if (newer) {
						status.textContent += " Your newer draft remains unsaved.";
					}
					restore();
				}
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
