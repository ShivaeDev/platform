import { Option, Schema } from "effect";
import { useState } from "react";

export const ROWS_PER_PAGE = 100;
export interface Paging {
	readonly showMore: () => void;
	readonly shown: number;
}

export function useLocalPaging(): Paging {
	const [shown, setShown] = useState(ROWS_PER_PAGE);
	return { showMore: () => setShown((current) => current + ROWS_PER_PAGE), shown };
}

const ROWS_KEY = "workBoardLibraryRows";
const Rows = Schema.Int.check(Schema.isGreaterThan(ROWS_PER_PAGE));

// Each history entry keeps its own row count, so Back can return to a row past the first page.
export function useEntryPaging(): Paging {
	const [shown, setShown] = useState(() =>
		Option.getOrElse(Schema.decodeUnknownOption(Rows)(Reflect.get(window.history.state ?? {}, ROWS_KEY)), () => ROWS_PER_PAGE),
	);
	return {
		showMore: () => {
			const next = shown + ROWS_PER_PAGE;
			setShown(next);
			window.history.replaceState({ ...window.history.state, [ROWS_KEY]: next }, "");
		},
		shown,
	};
}
