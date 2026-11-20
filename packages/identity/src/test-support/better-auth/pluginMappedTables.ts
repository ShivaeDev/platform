import { admin } from "better-auth/plugins";
import type { AuthTableOptions } from "#server/better-auth/tables.ts";

export const mappedTables = {
	account: {
		fields: { accountId: "externalId", providerId: "providerName", userId: "ownerId" },
		modelName: "authAccount",
	},
	user: {
		additionalFields: { role: { fieldName: "accessRole", type: "string" } },
		fields: { createdAt: "registeredAt", email: "contactEmail", name: "displayName", updatedAt: "modifiedAt" },
		modelName: "authUser",
	},
} satisfies AuthTableOptions;

export const pluginMappedTables = {
	...mappedTables,
	plugins: [admin({ schema: { user: { fields: { role: "pluginRole" } } } })],
	user: { fields: mappedTables.user.fields, modelName: mappedTables.user.modelName },
} satisfies AuthTableOptions;
