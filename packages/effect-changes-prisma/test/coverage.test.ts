import { expect, it } from "vitest";
import type { Observation } from "@shivaedev/effect-changes";
import { checkCoverage } from "../src/index.ts";

interface Change {
	readonly domain: string;
}

const tables = new Map([
	["orders", "Order"],
	["invoices", "Invoice"],
	["notes", "AuditNote"],
]);
const models = { AuditNote: null, Invoice: () => [], Order: () => [] };
const covers = (model: string, change: Change) => change.domain === model.toLowerCase();
const recorded = (...domains: readonly string[]): Observation<Change> => ({ _tag: "Recorded", changes: domains.map((domain) => ({ domain })) });

it("a written table is covered by a recorded change of its model, including changes that were later discarded", () => {
	const observations: readonly Observation<Change>[] = [
		recorded("order"),
		{ _tag: "Discarded", changes: [{ domain: "order" }] },
		recorded("invoice"),
		{ _tag: "Published", changes: [{ domain: "order" }] },
	];
	expect(checkCoverage({ covers, models, observations, tables, unnamed: [], written: ["orders", "invoices", "notes"] })).toEqual([]);
});

it("a written table without a covering change, or without a model, is reported once", () => {
	const observations: readonly Observation<Change>[] = [recorded("order"), { _tag: "Published", changes: [{ domain: "invoice" }] }];
	expect(checkCoverage({ covers, models, observations, tables, unnamed: [], written: ["orders", "invoices", "invoices", "_OrderToTag"] })).toEqual([
		{ _tag: "Unrecorded", model: "Invoice", table: "invoices" },
		{ _tag: "Unrecorded", model: undefined, table: "_OrderToTag" },
	]);
});

it("every distinct unnamed write is a violation even when its table is covered", () => {
	const countOnly = { model: "Order", operation: "updateMany", reason: "countOnly" } as const;
	const narrowed = { field: "ownerId", model: "Order", operation: "update", reason: "narrowed" } as const;
	expect(
		checkCoverage({ covers, models, observations: [recorded("order")], tables, unnamed: [countOnly, narrowed, countOnly], written: ["orders"] }),
	).toEqual([
		{ _tag: "Unnamed", write: countOnly },
		{ _tag: "Unnamed", write: narrowed },
	]);
});
