import { type ReactNode, useEffect, useRef } from "react";

export function Modal({
	id,
	title,
	open,
	close,
	children,
	opener,
	focus,
	returnFocus,
	className,
}: {
	readonly className?: string;
	readonly id: string;
	readonly title: string;
	readonly open: boolean;
	readonly close: () => void;
	readonly children: ReactNode;
	readonly opener?: string;
	readonly focus?: string;
	readonly returnFocus?: HTMLElement | undefined;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const previousRef = useRef<Element | null>(null);
	const selectionRef = useRef<ReturnType<typeof textSelection>>(undefined);
	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) {
			return;
		}
		if (open && !dialog.open) {
			const previous = returnFocus ?? (opener ? document.getElementById(opener) : document.activeElement);
			previousRef.current = previous;
			selectionRef.current = textSelection(previous);
			dialog.returnValue = "";
			dialog.showModal();
			if (focus) {
				document.getElementById(focus)?.focus();
			}
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open, opener, focus, returnFocus]);
	return (
		<dialog
			aria-labelledby={title}
			className={className}
			id={id}
			onCancel={() => close()}
			onClick={(event) => {
				if (event.target !== event.currentTarget) {
					return;
				}
				const bounds = event.currentTarget.getBoundingClientRect();
				if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
					close();
				}
			}}
			onClose={() => {
				close();
				const target = returnFocus ?? previousRef.current;
				if (ref.current?.returnValue !== "navigate" && target instanceof HTMLElement) {
					target.focus({ preventScroll: true });
					const selection = selectionRef.current;
					const control = textControl(target);
					if (selection && control) {
						control.setSelectionRange(selection.start, selection.end, selection.direction);
					}
				}
			}}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					close();
				}
			}}
			ref={ref}
		>
			{children}
		</dialog>
	);
}

function textControl(element: Element | null) {
	return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element : undefined;
}

function textSelection(element: Element | null) {
	const control = textControl(element);
	if (!control || control.selectionStart === null || control.selectionEnd === null) {
		return undefined;
	}
	return { direction: control.selectionDirection ?? "none", end: control.selectionEnd, start: control.selectionStart };
}
