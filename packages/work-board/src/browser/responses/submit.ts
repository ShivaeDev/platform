import { Schema } from "effect";
import { session } from "#browser/session.ts";
import type { draftSession } from "./draftSession.ts";
import type { Draft } from "./drafts.ts";
import { ResponseFailed, ResponseKind } from "./schema.ts";

export async function submitResponse(form: HTMLFormElement, status: HTMLParagraphElement, drafts: ReturnType<typeof draftSession>, pending: Draft) {
	status.dataset.outcome = "pending";
	status.textContent = "Pending: registering reviewed context, then recording response…";
	const native = session(window);
	try {
		const question = await native.mutate(
			native.responses.registerQuestion.run({ item: form.dataset.item ?? "", request: form.dataset.request ?? "", revision: pending.revision }),
		);
		await native.mutate(
			native.responses.recordResponse.run({
				author: pending.author,
				body: pending.body,
				id: pending.id,
				question: question.id,
				type: Schema.decodeUnknownSync(ResponseKind)(pending.type),
			}),
		);
		if (form.isConnected) {
			status.dataset.outcome = "saved";
			status.textContent = `Saved: responses/${pending.id}.md. This records feedback, not acceptance.`;
		}
		const cleared = drafts.saved(pending);
		if (!cleared && form.isConnected) {
			status.textContent += " Your current draft remains unsaved.";
		}
		return cleared;
	} catch (error) {
		if (form.isConnected) {
			const outcome = error instanceof ResponseFailed && error.code !== "Uncertain" ? "rejected" : "uncertain";
			status.dataset.outcome = outcome;
			status.textContent = `${outcome === "rejected" ? "Rejected" : "Uncertain"}: ${String(error)}. Draft retained. Preview and retry with the same identity; saved content will be reconciled.`;
		}
		return false;
	}
}
