import { Effect } from "effect";
import type ts from "typescript";
import { browserChecker as createBrowserChecker } from "#adapters/imports/browserChecker.ts";

export const browserChecker = Effect.fn("ImportCompiler.browserChecker")((source: ts.SourceFile) => Effect.sync(() => createBrowserChecker(source)));
