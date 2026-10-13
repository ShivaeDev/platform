import { Schema } from "effect";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { captureFocus, restoreFocus } from "#client/formFocus.ts";

const Selection = Schema.Struct({
	direction: Schema.NullOr(Schema.Literals(["forward", "backward", "none"])),
	end: Schema.NullOr(Schema.Number),
	name: Schema.String,
	prompt: Schema.optional(Schema.String),
	start: Schema.NullOr(Schema.Number),
});

export function useFormFocus(key: string) {
	const ref = useRef<HTMLFormElement>(null);

	const remember = useCallback(() => {
		const selection = ref.current && captureFocus(ref.current);
		if (!selection) {
			return false;
		}
		try {
			window.localStorage.setItem(`${key}:focus`, JSON.stringify(selection));
			return true;
		} catch {
			return false;
		}
	}, [key]);
	useLayoutEffect(() => {
		try {
			const stored: unknown = JSON.parse(window.localStorage.getItem(`${key}:focus`) ?? "null");
			if (ref.current && window.localStorage.getItem(key) && Schema.is(Selection)(stored)) {
				restoreFocus(ref.current, { ...stored, prompt: stored.prompt });
			}
		} catch {
			// Draft input remains usable when browser storage is unavailable.
		}
		return () => {
			remember();
		};
	}, [key, remember]);
	useEffect(() => {
		window.addEventListener("pagehide", remember);
		return () => window.removeEventListener("pagehide", remember);
	}, [remember]);
	return { onSelect: remember, ref };
}
