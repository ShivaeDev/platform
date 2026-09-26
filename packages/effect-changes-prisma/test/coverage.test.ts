import type { Observation } from "@shivaedev/effect-changes";
import { expect, test } from "vitest";
import { checkCoverage } from "../src/index.ts";

interface Change {
	readonly domain: string;
}

const tables = new Map([
	["orders", "Order"],
	["invoices", "Invoice"],
	["notes", "AuditNote"],
]);
const models = { Order: () => [], Invoice: () => [], AuditNote: null };
const covers = (model: string, change: Change) => change.domain === model.toLowerCase();
const recorded = (...domains: ReadonlyArray<string>): Observation<Change> => ({ _tag: "Recorded", changes: domains.map((domain) => ({ domain })) });

test("a written table is covered by a recorded change of its model, including changes that were later discarded", () => {
	const observations: ReadonlyArray<Observation<Change>> = [
		recorded("order"),
		{ _tag: "Discarded", changes: [{ domain: "order" }] },
		recorded("invoice"),
		{ _tag: "Published", changes: [{ domain: "order" }] },
	];
	expect(checkCoverage({ written: ["orders", "invoices", "notes"], tables, models, observations, unnamed: [], covers })).toEqual([]);
});

test("a written table without a covering change, or without a model, is reported once", () => {
	const observations: ReadonlyArray<Observation<Change>> = [recorded("order"), { _tag: "Published", changes: [{ domain: "invoice" }] }];
	expect(checkCoverage({ written: ["orders", "invoices", "invoices", "_OrderToTag"], tables, models, observations, unnamed: [], covers })).toEqual([
		{ _tag: "Unrecorded", table: "invoices", model: "Invoice" },
		{ _tag: "Unrecorded", table: "_OrderToTag", model: undefined },
	]);
});

test("every distinct unnamed write is a violation even when its table is covered", () => {
	const countOnly = { model: "Order", operation: "updateMany", reason: "countOnly" } as const;
	const narrowed = { model: "Order", operation: "update", reason: "narrowed", field: "ownerId" } as const;
	expect(
		checkCoverage({ written: ["orders"], tables, models, observations: [recorded("order")], unnamed: [countOnly, narrowed, countOnly], covers }),
	).toEqual([
		{ _tag: "Unnamed", write: countOnly },
		{ _tag: "Unnamed", write: narrowed },
	]);
});
