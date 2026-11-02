import { createContext } from "react";
import { createLazyChunks } from "#client/react/adapters/createLazyChunks.ts";

export type MarkdownRenderers = typeof import("./markdownRenderers.ts").markdownRenderers;

export const LazyChunksContext = createContext(createLazyChunks());
