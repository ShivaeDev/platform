// Operations of the refused module that return a brand, or a record keyed by one, in a form the wire cannot carry exactly.
export const REFUSED_BRANDS: Readonly<Record<string, string>> = {
	"src/modules/refused/brands.ts": `import { Effect } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { type Letter, type NoteId, noteId, type Shelf, type Sku, shared, type UserId } from "#modules/refused/shared.ts";

export const ReturnsBrand = query("returnsBrand", {
	reads: () => [shared.list],
	*run() {
		return noteId(yield* Effect.succeed(1));
	},
});

export const ReturnsTwiceBranded = query("returnsTwiceBranded", {
	reads: () => [shared.list],
	*run() {
		return yield* Effect.succeed("a" as Sku);
	},
});

export const ReturnsHandBranded = query("returnsHandBranded", {
	reads: () => [shared.list],
	*run() {
		return yield* Effect.succeed("a" as UserId);
	},
});

export const ReturnsNumberBrandKeys = query("returnsNumberBrandKeys", {
	reads: () => [shared.list],
	*run() {
		const titles: Record<NoteId, string> = yield* Effect.succeed({});
		return titles;
	},
});

export const ReturnsLiteralBrandKeys = query("returnsLiteralBrandKeys", {
	reads: () => [shared.list],
	*run() {
		return yield* Effect.succeed<Record<Letter, number>>({} as Record<Letter, number>);
	},
});

export const ReturnsReadonlyLiteralBrandKeys = query("returnsReadonlyLiteralBrandKeys", {
	reads: () => [shared.list],
	*run() {
		return yield* Effect.succeed<Readonly<Record<Letter | "c", number>>>({ c: 1 });
	},
});

export const ReturnsPartialRecord = query("returnsPartialRecord", {
	reads: () => [shared.list],
	*run() {
		const counts: Partial<Record<Shelf, number>> = yield* Effect.succeed({});
		return counts;
	},
});
`,
};
