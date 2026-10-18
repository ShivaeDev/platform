import { arraySamples } from "./arraySamples.ts";
import { compositeMeasurements } from "./compositeMeasurements.ts";
import { compositeReadings } from "./compositeReadings.ts";
import { conflictAccounts } from "./conflictAccounts.ts";
import { constrainedItems } from "./constrainedItems.ts";
import { generatedRows } from "./generatedRows.ts";
import { invoiceLines } from "./invoiceLines.ts";
import { jsonReceipts } from "./jsonReceipts.ts";
import { postgres } from "./sqlStory.ts";
import { wideRows } from "./wideRows.ts";
export function hasPostgresInvoiceLines() {
	return postgres.trait("schema", "invoice lines have their database schema", function* (engine) {
		engine.invoiceLines.set(yield* invoiceLines);
	});
}
export function hasArraySamples() {
	return postgres.trait("schema", "array samples have their database schema", function* (engine) {
		engine.arraySamples.set(yield* arraySamples);
	});
}
export function hasCompositeReadings() {
	return postgres.trait("schema", "composite readings have their database schema", function* (engine) {
		engine.compositeReadings.set(yield* compositeReadings);
	});
}
export function hasConflictAccounts() {
	return postgres.trait("schema", "conflict accounts have their database schema", function* (engine) {
		engine.conflictAccounts.set(yield* conflictAccounts);
	});
}
export function hasConstrainedItems() {
	return postgres.trait("schema", "constrained items have their database schema", function* (engine) {
		engine.constrainedItems.set(yield* constrainedItems);
	});
}
export function hasCompositeMeasurements() {
	return postgres.trait("schema", "composite measurements have their database schema", function* (engine) {
		engine.compositeMeasurements.set(yield* compositeMeasurements);
	});
}
export function hasGeneratedRows() {
	return postgres.trait("schema", "generated rows have their database schema", function* (engine) {
		engine.generatedRows.set(yield* generatedRows);
	});
}
export function hasWideRows() {
	return postgres.trait("schema", "wide rows have their database schema", function* (engine) {
		engine.wideRows.set(yield* wideRows);
	});
}
export function hasJsonReceipts() {
	return postgres.trait("schema", "json receipts have their database schema", function* (engine) {
		engine.jsonReceipts.set(yield* jsonReceipts);
	});
}
