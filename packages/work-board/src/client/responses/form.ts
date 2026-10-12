import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { make } from "@shivaedev/effect-form/form.ts";
import { fieldFeedback, type formOwner } from "#client/fieldFeedback.ts";
import type { Draft } from "./drafts.ts";
import type { responseFields } from "./fields.ts";
import { type ResponseSubmission, responseFormSchema } from "./formSchema.ts";
import type { questionnaireControls } from "./questionnaireControls.ts";

export function responseForm(
	form: HTMLFormElement,
	fields: NonNullable<ReturnType<typeof responseFields>>,
	draft: Draft,
	controls: ReturnType<typeof questionnaireControls>,
	owner: ReturnType<typeof formOwner>,
	onSubmit: (values: ResponseSubmission) => Promise<boolean>,
) {
	const { author, body, supersedes, type } = fields;
	const questionId = form.dataset.question ?? "";
	const model = make(responseFormSchema(controls.models.length > 0), {
		initialValues: {
			answers: controls.read(),
			author: author.value,
			body: body.value,
			id: draft.id,
			question: questionId,
			revision: draft.revision,
			supersedes: draft.supersedes,
			type: type.value,
		},
		onSubmit: (values) => Effect.tryPromise({ catch: (error) => error, try: () => onSubmit(values) }),
		runtime: Atom.runtime(Layer.empty),
	});
	const valid = fieldFeedback(
		model,
		owner,
		[
			{ control: author, name: "author" },
			{ control: body, name: "body" },
			{ control: type, name: "type" },
			{ control: supersedes instanceof HTMLSelectElement ? supersedes : undefined, name: "supersedes" },
			{ name: "answers" },
			{ name: "id" },
			{ name: "question" },
			{ name: "revision" },
		],
		[...form.querySelectorAll<HTMLTextAreaElement>("[data-answer-text]")].map((control, index) => ({ control, path: ["answers", index, "text"] })),
	);
	function sync() {
		model.change("author", fields.author.value);
		model.change("body", fields.body.value);
		model.change("type", fields.type.value);
		model.change("answers", controls.read());
		model.change("supersedes", supersedes instanceof HTMLSelectElement ? supersedes.value || undefined : undefined);
		return model.values.value;
	}
	return { model, sync, valid };
}
