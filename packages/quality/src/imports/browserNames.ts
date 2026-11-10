import { dirname, join } from "node:path";
import { type Context, Effect, type FileSystem } from "effect";
import ts from "typescript";
import { DeclarationFiles } from "#adapters/declaration-files/service.ts";
import { type FilesystemFailure, readRequiredText } from "#inventory/filesystem.ts";

const portable = new Set([
	"AbortController",
	"AbortSignal",
	"Blob",
	"BroadcastChannel",
	"ByteLengthQueuingStrategy",
	"CompressionStream",
	"CountQueuingStrategy",
	"Crypto",
	"CryptoKey",
	"CustomEvent",
	"DOMException",
	"DecompressionStream",
	"Event",
	"EventTarget",
	"File",
	"FormData",
	"Headers",
	"MessageChannel",
	"MessageEvent",
	"MessagePort",
	"Performance",
	"PerformanceEntry",
	"PerformanceMark",
	"PerformanceMeasure",
	"PerformanceObserver",
	"PerformanceObserverEntryList",
	"PerformanceResourceTiming",
	"ReadableByteStreamController",
	"ReadableStream",
	"ReadableStreamBYOBReader",
	"ReadableStreamBYOBRequest",
	"ReadableStreamDefaultController",
	"ReadableStreamDefaultReader",
	"Request",
	"Response",
	"SubtleCrypto",
	"TextDecoder",
	"TextDecoderStream",
	"TextEncoder",
	"TextEncoderStream",
	"TransformStream",
	"TransformStreamDefaultController",
	"URL",
	"URLPattern",
	"URLSearchParams",
	"WebSocket",
	"WritableStream",
	"WritableStreamDefaultController",
	"WritableStreamDefaultWriter",
	"atob",
	"btoa",
	"clearInterval",
	"clearTimeout",
	"console",
	"crypto",
	"fetch",
	"performance",
	"queueMicrotask",
	"setInterval",
	"setTimeout",
	"structuredClone",
]);

function namesInDom(source: ts.SourceFile): readonly string[] {
	return source.statements.flatMap((statement) => {
		if (ts.isVariableStatement(statement)) {
			return statement.declarationList.declarations.flatMap(({ name }) => (ts.isIdentifier(name) ? [name.text] : []));
		}
		return ts.isFunctionDeclaration(statement) && statement.name !== undefined ? [statement.name.text] : [];
	});
}

export const browserNames = Effect.fn("Imports.browserNames")(function* (): Effect.fn.Return<
	ReadonlySet<string>,
	FilesystemFailure,
	Context.Service.Identifier<typeof DeclarationFiles> | FileSystem.FileSystem
> {
	const path = join(dirname(ts.getDefaultLibFilePath({})), "lib.dom.d.ts");
	const text = yield* readRequiredText(path);
	const declarations = yield* DeclarationFiles;
	const source = yield* declarations.parse(path, text, { target: ts.ScriptTarget.Latest });
	return new Set(namesInDom(source).filter((name) => !portable.has(name)));
});
