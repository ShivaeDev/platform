export function textControl(element: Element | null | undefined) {
	return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element : undefined;
}

export function textSelection(element: Element | null | undefined) {
	const control = textControl(element);
	if (!control || control.selectionStart === null || control.selectionEnd === null) {
		return undefined;
	}
	return { direction: control.selectionDirection ?? "none", end: control.selectionEnd, start: control.selectionStart };
}
