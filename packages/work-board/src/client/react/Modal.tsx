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
}: {
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
	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) {
			return;
		}
		if (open && !dialog.open) {
			previousRef.current = opener ? document.getElementById(opener) : document.activeElement;
			dialog.returnValue = "";
			dialog.showModal();
			if (focus) {
				document.getElementById(focus)?.focus();
			}
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open, opener, focus]);
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
