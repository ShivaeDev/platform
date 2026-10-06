import { Option, Schema } from "effect";
import type { HandoffInput } from "#browser/handoffs/schema.ts";
import type { Draft } from "#browser/responses/drafts.ts";

const TextFields = Schema.Struct({ constraints: Schema.String, goal: Schema.String, nextAction: Schema.String });
export function handoffFields(form: HTMLFormElement) {
	const recipient = form.elements.namedItem("recipient");
	const goal = form.elements.namedItem("goal");
	const constraints = form.elements.namedItem("constraints");
	const nextAction = form.elements.namedItem("nextAction");
	if (
		!(
			recipient instanceof HTMLInputElement
			&& goal instanceof HTMLTextAreaElement
			&& constraints instanceof HTMLTextAreaElement
			&& nextAction instanceof HTMLTextAreaElement
		)
	) {
		return undefined;
	}
	return { constraints, goal, nextAction, recipient };
}
export function restoreFields(fields: NonNullable<ReturnType<typeof handoffFields>>, draft: Draft) {
	if (!draft.body) {
		return;
	}
	try {
		const saved = Schema.decodeUnknownOption(TextFields)(JSON.parse(draft.body));
		if (Option.isSome(saved)) {
			fields.constraints.value = saved.value.constraints;
			fields.goal.value = saved.value.goal;
			fields.nextAction.value = saved.value.nextAction;
			fields.recipient.value = draft.author;
		}
	} catch {
		fields.goal.value = draft.body;
		fields.recipient.value = draft.author;
	}
}
export function inputFrom(form: HTMLFormElement, draft: Draft): HandoffInput {
	const fields = Schema.decodeUnknownSync(TextFields)(JSON.parse(draft.body));
	return {
		...fields,
		id: draft.id,
		item: form.dataset.item ?? "",
		recipient: draft.author,
		revision: draft.revision,
		source: form.dataset.source ?? "",
	};
}
