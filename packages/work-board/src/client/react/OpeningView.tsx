import { shellIds } from "./shellIds.ts";

export function OpeningView() {
	return (
		<main className="board-view min-w-0 p-4 md:p-8" id={shellIds.doc} tabIndex={-1}>
			<p className="empty" role="status">
				Opening view…
			</p>
		</main>
	);
}
