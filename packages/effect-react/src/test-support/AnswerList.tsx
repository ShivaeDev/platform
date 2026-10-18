import { useAtomValue } from "@effect/atom-react";
import { useField, useSubmit } from "@shivaedev/effect-form/react.ts";
import { answerValues, type makeAnswerForm } from "./answerForm.ts";

type AnswerForm = ReturnType<typeof makeAnswerForm>;
function Answer({ form, id, index }: { readonly form: AnswerForm; readonly id: string; readonly index: number }) {
	const message = useAtomValue(form.errorAt(["answers", index, "text"]));
	const field = useField(form, "answers");
	return (
		<li data-answer={id}>
			<input
				name={id}
				onChange={(event) => field.onChange(field.value.map((answer) => (answer.id === id ? { ...answer, text: event.target.value } : answer)))}
				value={field.value[index]?.text ?? ""}
			/>
			<button
				onClick={() => field.onChange([...field.value.filter((answer) => answer.id === id), ...field.value.filter((answer) => answer.id !== id)])}
				type="button"
			>
				Move {id} first
			</button>
			<button onClick={() => field.onChange(field.value.filter((answer) => answer.id !== id))} type="button">
				Remove {id}
			</button>
			{message && <p role="alert">{message}</p>}
		</li>
	);
}
export function AnswerList({ form }: { readonly form: AnswerForm }) {
	const field = useField(form, "answers");
	const submit = useSubmit(form);
	return (
		<section>
			<ul>
				{field.value.map((answer, index) => (
					<Answer form={form} id={answer.id} index={index} key={answer.id} />
				))}
			</ul>
			<button onClick={submit.run} type="button">
				Save
			</button>
			<button onClick={() => field.onChange([answerValues.first, ...field.value.map((answer) => ({ ...answer }))])} type="button">
				Restore first
			</button>
		</section>
	);
}
