import { type ComponentProps, Suspense, useContext } from "react";
import { LoadedChunk } from "./LoadedChunk.tsx";
import { LazyChunksContext, type MarkdownRenderers } from "./lazyChunks.ts";

type DocumentProps = ComponentProps<MarkdownRenderers["DocumentView"]>;
type InlineProps = ComponentProps<MarkdownRenderers["InlineMarkdown"]>;
type ResponseProps = ComponentProps<MarkdownRenderers["ResponseMarkdown"]>;

function MarkdownUnavailable({ error }: { readonly error: string }) {
	return (
		<p data-markdown-error="" role="status">
			Markdown could not be loaded: {error}. Reload the page to try again.
		</p>
	);
}

function LoadedDocumentView(props: DocumentProps) {
	return (
		<LoadedChunk chunk={useContext(LazyChunksContext).markdown}>
			{(renderers) => ("error" in renderers ? <MarkdownUnavailable error={renderers.error} /> : <renderers.DocumentView {...props} />)}
		</LoadedChunk>
	);
}

function LoadedInlineMarkdown(props: InlineProps) {
	return (
		<LoadedChunk chunk={useContext(LazyChunksContext).markdown}>
			{(renderers) => ("error" in renderers ? props.source : <renderers.InlineMarkdown {...props} />)}
		</LoadedChunk>
	);
}

function LoadedResponseMarkdown(props: ResponseProps) {
	return (
		<LoadedChunk chunk={useContext(LazyChunksContext).markdown}>
			{(renderers) => ("error" in renderers ? <MarkdownUnavailable error={renderers.error} /> : <renderers.ResponseMarkdown {...props} />)}
		</LoadedChunk>
	);
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
