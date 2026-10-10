import type { ModelRow } from "#model.ts";
import type { PrismaClient } from "#test/generated/client.ts";

export function nonnegativeOrderChanges(error: Error) {
	return (row: ModelRow<PrismaClient, "Order">) => {
		if (row.total < 0) {
			throw error;
		}
		return [row.ownerId];
	};
}
