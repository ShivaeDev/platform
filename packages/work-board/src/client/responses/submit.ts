import { Schema } from "effect";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { session } from "#client/session.ts";
import { PublicationUncertain, ResponseRejection } from "#rpc/rejections.ts";
import type { ResponseSubmission } from "./formSchema.ts";

export async function submitResponse(form: HTMLFormElement, status: HTMLParagraphElement, values: ResponseSubmission) {
	status.dataset.outcome = "pending";
	status.textContent = "Pending: registering reviewed context, then recording response…";
	const native = session(window);
	try {
		const question = await native.mutate(
			native.responses.registerQuestion.run({ item: form.dataset.item ?? "", request: form.dataset.request ?? "", revision: values.revision }),
		);
		const { recovery: _recovery, ...input } = values;
		await native.mutate(native.responses.recordResponse.run({ ...input, question: question.id }));
		if (form.isConnected) {
			status.dataset.outcome = "saved";
			status.textContent = `Saved: responses/${values.id}.md. This records feedback, not acceptance.`;
		}
	} catch (error) {
		if (form.isConnected) {
			const outcome =
				Schema.is(ResponseRejection)(error) && !(error instanceof PublicationUncertain) && !(error instanceof InternalServerError)
					? "rejected"
					: "uncertain";
			status.dataset.outcome = outcome;
			status.textContent = `${outcome === "rejected" ? "Rejected" : "Uncertain"}: ${String(error)}. Draft retained. Preview and retry with the same identity; saved content will be reconciled.`;
		}
		throw error;
	}
}
