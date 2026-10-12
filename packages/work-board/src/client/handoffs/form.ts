import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { make } from "@shivaedev/effect-form/form.ts";
import { type Handoff, HandoffInput } from "#browser/handoffs/schema.ts";
import { fieldFeedback, type formOwner } from "#client/fieldFeedback.ts";
import { formDraft } from "#client/formDraft.ts";
import type { handoffFields } from "./fields.ts";

export function handoffForm(
	dom: HTMLFormElement,
	fields: NonNullable<ReturnType<typeof handoffFields>>,
	owner: ReturnType<typeof formOwner>,
	onSubmit: (input: HandoffInput) => Promise<Handoff>,
) {
	const model = make(HandoffInput, {
		initialValues: {
			constraints: fields.constraints.value,
			goal: fields.goal.value,
			id: "",
			item: dom.dataset.item ?? "",
			nextAction: fields.nextAction.value,
			recipient: fields.recipient.value,
			revision: "",
			source: dom.dataset.source ?? "",
		},
		onSubmit: (input) => Effect.tryPromise({ catch: (error) => error, try: () => onSubmit(input) }),
		persistedDraft: formDraft(dom, "handoff"),
		runtime: Atom.runtime(Layer.empty),
	});
	function restore() {
		const values = model.values.value;
		fields.constraints.value = values.constraints;
		fields.goal.value = values.goal;
		fields.nextAction.value = values.nextAction;
		fields.recipient.value = values.recipient;
	}
	restore();
	const valid = fieldFeedback(model, owner, [
		{ control: fields.constraints, name: "constraints" },
		{ control: fields.goal, name: "goal" },
		{ control: fields.nextAction, name: "nextAction" },
		{ control: fields.recipient, name: "recipient" },
		{ name: "id" },
		{ name: "item" },
		{ name: "revision" },
		{ name: "source" },
	]);
	return { model, restore, valid };
}
