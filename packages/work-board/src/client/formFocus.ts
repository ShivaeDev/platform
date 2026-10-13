export interface FormFocus {
	readonly direction: "forward" | "backward" | "none" | null;
	readonly end: number | null;
	readonly name: string;
	readonly prompt: string | undefined;
	readonly start: number | null;
}
export function captureFocus(host: HTMLElement): FormFocus | undefined {
	const control = document.activeElement;
	if (!((control instanceof HTMLTextAreaElement || (control instanceof HTMLInputElement && control.type === "text")) && host.contains(control))) {
		return;
	}
	return {
		direction: control.selectionDirection,
		end: control.selectionEnd,
		name: control.name,
		prompt: control.closest<HTMLElement>("[data-prompt]")?.dataset.prompt,
		start: control.selectionStart,
	};
}
export function restoreFocus(main: HTMLElement, selection: FormFocus | undefined) {
	if (!selection) {
		return;
	}
	const focused = [...main.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")].find(
		(field) => field.name === selection.name && field.closest<HTMLElement>("[data-prompt]")?.dataset.prompt === selection.prompt,
	);
	for (let parent = focused?.parentElement; parent; parent = parent.parentElement) {
		if (parent instanceof HTMLDetailsElement) {
			parent.open = true;
		}
	}
	focused?.focus({ preventScroll: true });
	if (selection.start !== null && selection.end !== null) {
		focused?.setSelectionRange(selection.start, selection.end, selection.direction ?? undefined);
	}
}
