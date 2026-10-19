import { FileQuestion } from "lucide-react";
import { useLayoutEffect } from "react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#client/react/components/ui/empty.tsx";
import { decodedPath, itemRouteId } from "./documentRoute.ts";
import { LinkButton } from "./LinkButton.tsx";
import { type MainLocation, NOT_FOUND_PROJECTION } from "./mainLocation.ts";
import { shellIds } from "./shellIds.ts";

const NOT_FOUND_TITLE = "Page not found";

export function NotFoundMain({ onPage, url }: { readonly onPage: (location: MainLocation) => void; readonly url: string }) {
	useLayoutEffect(() => {
		onPage({ file: "", projection: NOT_FOUND_PROJECTION, route: url, status: 404, title: NOT_FOUND_TITLE, view: "" });
	}, [onPage, url]);
	return (
		<main className="document-view min-w-0 p-4 md:p-8" data-route={url} data-status="404" data-url={url} id={shellIds.doc} tabIndex={-1}>
			<NotFoundPage url={url} />
		</main>
	);
}

export function NotFoundPage({ url }: { readonly url: string }) {
	const { title, description } = notFound(new URL(url, "http://127.0.0.1").pathname);
	return (
		<Empty className="mx-auto mt-8 max-w-xl border">
			<EmptyHeader role="status">
				<EmptyMedia variant="icon">
					<FileQuestion />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			<EmptyContent className="flex-row justify-center">
				<LinkButton href="/">Back to Today</LinkButton>
				<LinkButton href="/_board/library">Browse the Library</LinkButton>
			</EmptyContent>
		</Empty>
	);
}

function notFound(pathname: string) {
	const item = itemRouteId(pathname);
	if (item !== undefined) {
		return { description: `No item has the ID ${item}. It may be missing, renamed, or invalid.`, title: "Item not found" };
	}
	if (/\.md$/iu.test(pathname)) {
		return { description: `No Markdown file at ${decodedPath(pathname)}. It may have been moved or deleted.`, title: "File not found" };
	}
	return { description: `Nothing on the Board lives at ${pathname}. The link may be old or mistyped.`, title: NOT_FOUND_TITLE };
}
