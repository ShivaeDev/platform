import type { Schema } from "effect";
import { InternalServerError, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { CommandShape, QueryShape } from "#operation.ts";
import { rejectionSet } from "#rejection.ts";
import type { ClassRejections, SpecsOf } from "#runProof.ts";
import type { ServedCommand, ServedQuery } from "#servedOperation.ts";

// The schemas an operation's run implies, as values: types are erased, so the server encodes and the browser decodes with these.
export interface WireEntry {
	readonly rejections: ClassRejections;
	readonly success: Schema.Top;
}

export interface Wire {
	readonly [operation: string]: WireEntry;
}

export type WireEntryOf<TWire, TName> = TName extends keyof TWire ? (TWire[TName] extends WireEntry ? TWire[TName] : undefined) : undefined;

export type Wired<TOperation, TEntry> = TEntry extends WireEntry
	? TOperation extends ServedQuery<infer TName, infer TPayload, infer _TSuccess, infer _TSpecs, infer TPolicyError, infer TPolicyServices, infer TRun>
		? ServedQuery<TName, TPayload, TEntry["success"], SpecsOf<TEntry["rejections"]>, TPolicyError, TPolicyServices, TRun>
		: TOperation extends ServedCommand<infer TName, infer TPayload, infer _TSuccess, infer _TSpecs, infer TRun>
			? ServedCommand<TName, TPayload, TEntry["success"], SpecsOf<TEntry["rejections"]>, TRun>
			: TOperation
	: TOperation;

export type WiredAll<TOperations extends readonly unknown[], TWire> = {
	readonly [TIndex in keyof TOperations]: Wired<
		TOperations[TIndex],
		WireEntryOf<TWire, TOperations[TIndex] extends { readonly name: infer TName } ? TName : never>
	>;
};

export function wireRejections(rejections: ClassRejections) {
	return { ...rejections, InternalServerError, ServiceUnavailable };
}

export function wired(operation: QueryShape | CommandShape, entry: WireEntry | undefined): QueryShape | CommandShape {
	if (entry === undefined) {
		return operation;
	}
	const rejections = wireRejections(entry.rejections);
	return { ...operation, rejections, success: entry.success, ...rejectionSet(rejections) };
}
