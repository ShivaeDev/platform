import { Effect } from "effect";
import ts from "typescript";

export const initializeDeclarationFiles = Effect.sync(() => ({ registry: ts.createDocumentRegistry(ts.sys.useCaseSensitiveFileNames) }));
