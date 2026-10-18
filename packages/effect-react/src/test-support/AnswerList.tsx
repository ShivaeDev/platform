import { useAtomValue } from "@effect/atom-react";
import { createElement } from "react";
import { useField, useSubmit } from "@shivaedev/effect-form/client/react.ts";
import type { makeAnswerForm } from "./answerForm.ts";

type AnswerForm = ReturnType<typeof makeAnswerForm>;

function Answer({ form, id, index }: { readonly form: AnswerForm; readonly id: string; readonly index: number }) {
	const message = useAtomValue(form.errorAt(["answers", index, "text"]));
	return createElement("li", { "data-answer": id }, message && createElement("p", { role: "alert" }, message));
}

export function AnswerList({ form }: { readonly form: AnswerForm }) {
	const field = useField(form, "answers");
	const submit = useSubmit(form);
	return createElement(
		"section",
		null,
		createElement(
			"ul",
			null,
			field.value.map((answer, index) => createElement(Answer, { form, id: answer.id, index, key: answer.id })),
		),
		createElement("button", { onClick: submit.run, type: "button" }, "Save"),
	);
}
