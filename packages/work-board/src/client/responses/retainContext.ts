import type { Form } from "@shivaedev/form/shape.ts";
import type { ResponseSubmission, responseFormSchema } from "./formSchema.ts";

type ResponseForm = Form<ReturnType<typeof responseFormSchema>["fields"], ResponseSubmission, unknown, never>;
export function retainContext(form: ResponseForm, saved: ResponseSubmission) {
	if (form.values.value.id) {
		return;
	}
	form.change("id", `response.${crypto.randomUUID()}`);
	form.change("question", saved.question);
	form.change("revision", saved.revision);
	if (!form.values.value.answerContext) {
		form.change("answerContext", saved.answerContext);
	}
}
