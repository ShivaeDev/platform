import { type ReactNode, useEffect, useRef } from "react";
import { textControl, textSelection } from "#client/react/textSelection.ts";

export function Modal({
	id,
	title,
	open,
	close,
	children,
	opener,
	returnFocus,
}: {
	readonly id: string;
	readonly title: string;
	readonly open: boolean;
	readonly close: () => void;
	readonly children: ReactNode;
	readonly opener?: string;
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
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open, opener, returnFocus]);
	return (
		<dialog
			aria-labelledby={title}
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
