import { Effect } from "effect";
import type ts from "typescript";
import { browserChecker } from "./browserChecker.ts";

export const checkBrowser = Effect.fn("ImportCompiler.checkBrowser")((source: ts.SourceFile) => Effect.sync(() => browserChecker(source)));
