const DIALOG_SELECTOR = 'dialog,[role="dialog"],[role="alertdialog"]';

export function screenDialogs(root: HTMLElement) {
	const member = root.closest("[data-story-member]");
	const controls = member
		? [...member.querySelectorAll("[aria-controls]")].flatMap((element) => element.getAttribute("aria-controls")?.split(/\s+/u) ?? [])
		: [];
	return [...root.ownerDocument.body.querySelectorAll<HTMLElement>(DIALOG_SELECTOR)].filter(
		(dialog) =>
			!dialog.matches("dialog:not([open])") && (member === null || member.contains(dialog) || (dialog.id !== "" && controls.includes(dialog.id))),
	);
}
