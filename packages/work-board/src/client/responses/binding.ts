import { captureFocus } from "#client/formFocus.ts";

const bindings = new WeakMap<HTMLFormElement, { readonly context: string; readonly release: () => void }>();
function contextOf(form: HTMLFormElement) {
	return `${form.dataset.question}:${form.dataset.revision}`;
}
export function responseBinding(form: HTMLFormElement) {
	const previous = bindings.get(form);
	if (previous && previous.context !== contextOf(form)) {
		previous.release();
	}
	return captureFocus(form);
}
export function retainResponseBinding(form: HTMLFormElement, release: () => void) {
	bindings.set(form, { context: contextOf(form), release });
}
