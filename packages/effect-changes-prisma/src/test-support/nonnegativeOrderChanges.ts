import type { ModelRow } from "#model.ts";
import type { PrismaClient } from "#test/generated/client.ts";
import { models } from "./changes.ts";

export function nonnegativeOrderChanges(error: Error) {
	return (row: ModelRow<PrismaClient, "Order">) => {
		if (row.total < 0) {
			throw error;
		}
		return models.Order(row);
	};
}
