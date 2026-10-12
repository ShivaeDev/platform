import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { make } from "@shivaedev/effect-form/form.ts";
import { fieldFeedback, type formOwner } from "#client/fieldFeedback.ts";
import { formDraft } from "#client/formDraft.ts";
import { authorLabel } from "./authorLabel.ts";
import type { responseFields } from "./fields.ts";
import { type ResponseSubmission, responseFormSchema } from "./formSchema.ts";
import type { questionnaireControls } from "./questionnaireControls.ts";

export function responseForm(
	form: HTMLFormElement,
	fields: NonNullable<ReturnType<typeof responseFields>>,
	controls: ReturnType<typeof questionnaireControls>,
	owner: ReturnType<typeof formOwner>,
	onSubmit: (values: ResponseSubmission) => Promise<void>,
) {
	const { author, body, supersedes, type } = fields;
	const label = authorLabel(() => window.localStorage, document.documentElement.dataset.workspace);
	const model = make(responseFormSchema(controls.models.length > 0), {
		initialValues: {
			answers: controls.models.length > 0 ? controls.models.map((prompt) => ({ prompt: prompt.id, selected: [], text: "" })) : undefined,
			author: label.read(""),
			body: "",
			id: "",
			question: "",
			revision: "",
			supersedes: undefined,
			type: "answer",
		},
		onSubmit: (values) => Effect.tryPromise({ catch: (error) => error, try: () => onSubmit(values) }),
		persistedDraft: formDraft(form, "response"),
		runtime: Atom.runtime(Layer.empty),
	});
	function restore() {
		const values = model.values.value;
		author.value = values.author;
		body.value = values.body;
		type.value = values.type;
		if (supersedes instanceof HTMLSelectElement) {
			supersedes.value = values.supersedes ?? "";
		}
		return controls.restore(values, form.dataset.revision ?? "");
	}
	const recovery = restore();
	if (recovery !== model.values.value.recovery) {
		model.change("recovery", recovery);
	}
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
		if (!model.values.value.id) {
			model.change("id", `response.${crypto.randomUUID()}`);
			model.change("revision", form.dataset.revision ?? "");
			model.change("question", form.dataset.question ?? "");
		}
		label.save(fields.author.value);
		model.change("author", fields.author.value);
		model.change("body", fields.body.value);
		model.change("type", fields.type.value);
		model.change("answers", controls.read());
		model.change("supersedes", supersedes instanceof HTMLSelectElement ? supersedes.value || undefined : undefined);
		return model.values.value;
	}
	return { model, restore, sync, valid };
}
