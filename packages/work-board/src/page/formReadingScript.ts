export function formReadingScript(): string {
	return `
const captureResponseFocus = () => {
  const control = document.activeElement;
  if (!(control instanceof HTMLTextAreaElement || control instanceof HTMLInputElement && control.type === "text") || !control.closest("#response-form")) return null;
  return {
    name: control.name,
    prompt: control.closest("[data-prompt]")?.dataset.prompt,
    start: control.selectionStart,
    end: control.selectionEnd,
    direction: control.selectionDirection,
  };
};
const restoreResponseFocus = (state) => {
  if (!state) return;
  const form = document.getElementById("response-form");
  const control = state.prompt
    ? [...(form?.querySelectorAll("[data-prompt]") ?? [])].find((field) => field.dataset.prompt === state.prompt)?.querySelector("textarea")
    : form?.elements.namedItem(state.name);
  if (!control) return;
  control.focus({ preventScroll: true });
  if (state.start !== null && state.end !== null && control.setSelectionRange) control.setSelectionRange(state.start, state.end, state.direction);
};
`;
}
