import { copyPrompts, preparedPrompt } from "#browser/handoffs/copy.ts";
import { handoffFields, inputFrom, restoreFields } from "#browser/handoffs/fields.ts";
import { draftSession } from "#browser/responses/draftSession.ts";
import { ResponseFailed } from "#browser/responses/schema.ts";
import { session } from "#browser/session.ts";

const bound = new WeakSet<HTMLFormElement>();
function attach() {
	const doc = document.getElementById("doc");
	if (doc?.dataset.view !== "handoff") {
		return;
	}
	copyPrompts(doc);
	const form = doc.querySelector<HTMLFormElement>("#handoff-form");
	if (!form || bound.has(form)) {
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
	bound.add(form);
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
	function save() {
		draft = drafts.update({
			author: fields.recipient.value,
			body: JSON.stringify({ constraints: fields.constraints.value, goal: fields.goal.value, nextAction: fields.nextAction.value }),
		});
	}
	form.addEventListener("input", () => {
		save();
		preview.hidden = true;
		submit.disabled = true;
	});
	previewButton.disabled = false;
	clear.disabled = false;
	clear.addEventListener("click", drafts.clear);
	previewButton.addEventListener("click", () => {
		save();
		draft = drafts.update({
			id: draft.revision === revision && (!draft.question || draft.question === question) ? draft.id : `handoff.${crypto.randomUUID()}`,
			question,
			revision,
		});
		const input = inputFrom(form, draft);
		preview.textContent = `New file: handoffs/${input.id}.md\nPrepared time and reviewed snapshot are assigned by the server.\n\n---\n${JSON.stringify({ handoff: { constraints: input.constraints, goal: input.goal, item: input.item, "next_action": input.nextAction, recipient: input.recipient, "reviewed_revision": input.revision, source: input.source, state: "requested" }, id: input.id, kind: "handoff" }, null, 2)}\n---\nThe complete reviewed source is preserved below the frontmatter.`;
		preview.hidden = false;
		submit.disabled = form.dataset.writable !== "true" || !form.checkValidity();
	});
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (submit.disabled || !form.reportValidity()) {
			return;
		}
		const pending = draft;
		submit.disabled = true;
		previewButton.disabled = true;
		status.textContent = "Pending: preparing the local handoff file…";
		try {
			const native = session(window);
			const saved = await native.mutate(native.handoffs.prepareHandoff.run(inputFrom(form, pending)));
			const cleared = drafts.saved(pending);
			draft = drafts.current();
			if (form.isConnected) {
				status.textContent = `Prepared: ${saved.file}. Receipt: ${saved.handoff.state}; execution and acceptance remain separate.${cleared ? "" : " Your newer draft remains unsaved."}`;
				preparedPrompt(prepared, saved.id, saved.prompt);
			}
		} catch (error) {
			if (form.isConnected) {
				status.textContent = failureStatus(error);
			}
		}
		previewButton.disabled = false;
	});
}
function failureStatus(error: unknown) {
	return `${error instanceof ResponseFailed && error.code !== "Uncertain" ? "Rejected" : "Uncertain"}: ${String(error)}. Draft retained; preview and retry.`;
}
export function setupHandoffs() {
	document.addEventListener("board-page", attach);
	window.addEventListener("pageshow", attach);
	attach();
}
