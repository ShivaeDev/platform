import { DocumentView } from "#client/document/View.ts";
import { InlineMarkdown } from "#client/react/adapters/InlineMarkdown.tsx";
import { ResponseMarkdown } from "#client/react/adapters/ResponseMarkdown.tsx";

export const markdownRenderers = { DocumentView, InlineMarkdown, ResponseMarkdown };
