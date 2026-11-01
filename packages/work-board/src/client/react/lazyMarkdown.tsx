import { type ComponentProps, Suspense, use, useContext } from "react";
import { LazyChunksContext, type MarkdownRenderers } from "./lazyChunks.ts";

type DocumentProps = ComponentProps<MarkdownRenderers["DocumentView"]>;
type InlineProps = ComponentProps<MarkdownRenderers["InlineMarkdown"]>;
type ResponseProps = ComponentProps<MarkdownRenderers["ResponseMarkdown"]>;

function useMarkdownRenderers() {
	const chunk = useContext(LazyChunksContext).markdown;
	return chunk.loaded() ?? use(chunk.load());
}

function MarkdownUnavailable({ error }: { readonly error: string }) {
	return (
		<p data-markdown-error="" role="status">
			Markdown could not be loaded: {error}. Reload the page to try again.
		</p>
	);
}

function LoadedDocumentView(props: DocumentProps) {
	const renderers = useMarkdownRenderers();
	return "error" in renderers ? <MarkdownUnavailable error={renderers.error} /> : <renderers.DocumentView {...props} />;
}

function LoadedInlineMarkdown(props: InlineProps) {
	const renderers = useMarkdownRenderers();
	return "error" in renderers ? props.source : <renderers.InlineMarkdown {...props} />;
}

function LoadedResponseMarkdown(props: ResponseProps) {
	const renderers = useMarkdownRenderers();
	return "error" in renderers ? <MarkdownUnavailable error={renderers.error} /> : <renderers.ResponseMarkdown {...props} />;
}

export function LazyDocumentView(props: DocumentProps) {
	return (
		<Suspense fallback={null}>
			<LoadedDocumentView {...props} />
		</Suspense>
	);
}

export function LazyInlineMarkdown(props: InlineProps) {
	return (
		<Suspense fallback={null}>
			<LoadedInlineMarkdown {...props} />
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
