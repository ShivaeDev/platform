import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import ts from "typescript";

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

function namesInDom(): readonly string[] {
	const path = join(dirname(ts.getDefaultLibFilePath({})), "lib.dom.d.ts");
	const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
	return source.statements.flatMap((statement) => {
		if (ts.isVariableStatement(statement)) {
			return statement.declarationList.declarations.flatMap(({ name }) => (ts.isIdentifier(name) ? [name.text] : []));
		}
		return ts.isFunctionDeclaration(statement) && statement.name !== undefined ? [statement.name.text] : [];
	});
}

export const browserNames: ReadonlySet<string> = new Set(namesInDom().filter((name) => !portable.has(name)));
