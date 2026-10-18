import { shellIds } from "./shellIds.ts";
import { ViewStatus } from "./ViewStatus.tsx";

export function OpeningView() {
	return (
		<main className="board-view min-w-0 p-4 md:p-8" id={shellIds.doc} tabIndex={-1}>
			<ViewStatus>Opening view…</ViewStatus>
		</main>
	);
}
