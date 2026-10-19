import { useEffect, useState } from "react";

const NOT_TYPED = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);

function typed(target: EventTarget | null) {
	if (target instanceof HTMLTextAreaElement) {
		return true;
	}
	if (target instanceof HTMLInputElement) {
		return !NOT_TYPED.has(target.type);
	}
	return target instanceof HTMLElement && target.isContentEditable;
}

export function useTextFocus() {
	const [focused, setFocused] = useState(() => typeof document !== "undefined" && typed(document.activeElement));
	useEffect(() => {
		function enter(event: FocusEvent) {
			setFocused(typed(event.target));
		}
		function leave(event: FocusEvent) {
			setFocused(typed(event.relatedTarget));
		}
		document.addEventListener("focusin", enter);
		document.addEventListener("focusout", leave);
		return () => {
			document.removeEventListener("focusin", enter);
			document.removeEventListener("focusout", leave);
		};
	}, []);
	return focused;
}
