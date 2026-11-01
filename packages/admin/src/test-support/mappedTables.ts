import type { AuthTableOptions } from "@shivaedev/identity/server/better-auth/tables.ts";

export const mappedTables = {
	user: {
		additionalFields: { role: { fieldName: "accessRole", type: "string" } },
		fields: { createdAt: "registeredAt", email: "contactEmail", name: "displayName", updatedAt: "modifiedAt" },
		modelName: "authUser",
	},
} satisfies AuthTableOptions;
