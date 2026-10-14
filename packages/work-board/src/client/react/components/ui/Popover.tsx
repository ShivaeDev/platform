import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "#client/react/lib/cn.ts";
import { Button } from "./Button.tsx";
export function Popover({
	label,
	trigger,
	children,
	className,
	triggerId,
}: {
	readonly label: string;
	readonly trigger: ReactNode;
	readonly children: ReactNode;
	readonly className?: string;
	readonly triggerId?: string;
}) {
	const id = useId();
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (!open) {
			return;
		}
		contentRef.current?.querySelector<HTMLElement>("select, button, input")?.focus();
		function outside(event: PointerEvent) {
			if (event.target instanceof Node && !ref.current?.contains(event.target)) {
				setOpen(false);
			}
		}
		function onEscape(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.preventDefault();
				setOpen(false);
				buttonRef.current?.focus();
			}
		}
		function onFocus(event: FocusEvent) {
			if (event.target instanceof Node && !ref.current?.contains(event.target)) {
				setOpen(false);
			}
		}
		document.addEventListener("focusin", onFocus);
		document.addEventListener("pointerdown", outside);
		document.addEventListener("keydown", onEscape);
		return () => {
			document.removeEventListener("focusin", onFocus);
			document.removeEventListener("pointerdown", outside);
			document.removeEventListener("keydown", onEscape);
		};
	}, [open]);
	return (
		<div className="relative shrink-0" ref={ref}>
			<Button
				aria-controls={id}
				aria-expanded={open}
				aria-haspopup="dialog"
				aria-label={label}
				id={triggerId}
				onClick={() => setOpen(!open)}
				ref={buttonRef}
				size="icon"
				variant="ghost"
			>
				{trigger}
			</Button>
			<div
				aria-label={label}
				className={cn(
					"absolute top-full right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-4 text-popover-foreground text-sm shadow-lg",
					className,
				)}
				hidden={!open}
				id={id}
				ref={contentRef}
				role="dialog"
			>
				{children}
			</div>
		</div>
	);
}
