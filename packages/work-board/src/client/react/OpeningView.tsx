import { LoadingPage } from "./LoadingPage.tsx";
import { shellIds } from "./shellIds.ts";

export function OpeningView({ url }: { readonly url: string }) {
	return (
		<main className="board-view min-w-0 p-4 md:p-8" id={shellIds.doc} tabIndex={-1}>
			<LoadingPage url={url} />
		</main>
	);
}
