import { useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type { ChangeEvent } from "react";
import { useField } from "@shivaedev/form/client/react.ts";
import type { FieldFailure, Form } from "@shivaedev/form/shape.ts";
import { useCreate } from "#client/create.ts";
import { useEditor } from "#client/editor.ts";
import { Answers, initialValues, type Kind, query, saveAnswers, TitleCheck } from "./formOptionsModel.ts";

interface Props {
	readonly kind: Kind;
	readonly runtime: Atom.AtomRuntime<TitleCheck>;
}
function config(runtime: Props["runtime"]) {
	return {
		arrayKeys: { answers: (answer: Answers["answers"][number]) => answer.id },
		checks: { title: (value: string) => Effect.flatMap(TitleCheck, (service) => service.check(value)) },
		debounce: "50 millis" as const,
		fields: Answers,
		requiredMessages: { title: "Give this editor a title" },
		runtime,
	};
}
function EditorView({ runtime }: Props) {
	const editor = useEditor({ ...config(runtime), loaded: initialValues, query, save: saveAnswers, values: (row) => row });
	return <Controls form={editor.form} onSave={editor.save} />;
}
function CreateView({ runtime }: Props) {
	const create = useCreate({ ...config(runtime), create: saveAnswers, initialValues });
	return <Controls form={create.form} onSave={create.save} />;
}
export function FormOptionsView(props: Props) {
	return props.kind === "editor" ? <EditorView {...props} /> : <CreateView {...props} />;
}
type CurrentForm = Form<typeof Answers.fields, Answers, FieldFailure, never>;
function Answer({ form, index, id }: { readonly form: CurrentForm; readonly index: number; readonly id: string }) {
	const error = useAtomValue(form.errorAt(["answers", index, "text"]));
	const feedback = error === undefined ? null : <p role="alert">{error}</p>;
	return (
		<li data-answer={id}>
			{id}
			{feedback}
		</li>
	);
}
function Controls({ form, onSave }: { readonly form: CurrentForm; readonly onSave: () => void }) {
	const title = useField(form, "title");
	const answers = useField(form, "answers");
	function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
		title.onChange(event.target.value);
	}
	function handleReverse() {
		answers.onChange([...answers.value].reverse());
	}
	return (
		<section>
			<input name="title" onChange={handleTitleChange} value={title.value} />
			<output>{title.error ?? "none"}</output>
			<ul>
				{answers.value.map((answer, index) => (
					<Answer form={form} id={answer.id} index={index} key={answer.id} />
				))}
			</ul>
			<button onClick={onSave} type="button">
				Save
			</button>
			<button onClick={handleReverse} type="button">
				Reverse answers
			</button>
		</section>
	);
}
