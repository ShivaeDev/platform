import { DocumentView } from "#client/document/View.ts";
import { InlineMarkdown } from "./InlineMarkdown.tsx";
import { ResponseMarkdown } from "./ResponseMarkdown.tsx";

export const markdownRenderers = { DocumentView, InlineMarkdown, ResponseMarkdown };
