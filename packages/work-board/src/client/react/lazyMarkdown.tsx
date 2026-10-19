import { type ComponentProps, Suspense, use } from "react";
import { loadedMarkdownRenderers, loadMarkdownRenderers, type MarkdownRenderers } from "./markdownLoader.ts";

type DocumentProps = ComponentProps<MarkdownRenderers["DocumentView"]>;
type ResponseProps = ComponentProps<MarkdownRenderers["ResponseMarkdown"]>;

function useMarkdownRenderers() {
	return loadedMarkdownRenderers() ?? use(loadMarkdownRenderers());
}

function LoadedDocumentView(props: DocumentProps) {
	const { DocumentView } = useMarkdownRenderers();
	return <DocumentView {...props} />;
}

function LoadedResponseMarkdown(props: ResponseProps) {
	const { ResponseMarkdown } = useMarkdownRenderers();
	return <ResponseMarkdown {...props} />;
}

export function LazyDocumentView(props: DocumentProps) {
	return (
		<Suspense fallback={null}>
			<LoadedDocumentView {...props} />
		</Suspense>
	);
}

export function LazyResponseMarkdown(props: ResponseProps) {
	return (
		<Suspense fallback={null}>
			<LoadedResponseMarkdown {...props} />
		</Suspense>
	);
}
