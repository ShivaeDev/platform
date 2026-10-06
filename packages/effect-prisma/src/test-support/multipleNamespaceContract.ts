import { contractJson } from "#test/contract.ts";

export const multipleNamespaceContract = {
	...contractJson,
	domain: {
		...contractJson.domain,
		namespaces: {
			...contractJson.domain.namespaces,
			audit: { models: {} },
		},
	},
};
