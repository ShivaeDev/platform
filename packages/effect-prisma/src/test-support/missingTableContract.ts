import { contractJson } from "#test/contract.ts";

function renamedTableEntries(tableName: string) {
	const { user, ...tables } = contractJson.storage.namespaces.public.entries.table;
	return {
		...tables,
		[tableName]: user,
		post: {
			...tables.post,
			foreignKeys: tables.post.foreignKeys.map((key) => ({ ...key, target: { ...key.target, tableName } })),
		},
	};
}

export function missingTableContract(tableName: string) {
	const namespace = contractJson.storage.namespaces.public;
	const model = contractJson.domain.namespaces.public.models.User;
	return {
		...contractJson,
		domain: {
			...contractJson.domain,
			namespaces: {
				public: {
					models: {
						...contractJson.domain.namespaces.public.models,
						User: { ...model, storage: { ...model.storage, table: tableName } },
					},
				},
			},
		},
		storage: {
			...contractJson.storage,
			namespaces: {
				public: {
					...namespace,
					entries: {
						...namespace.entries,
						table: renamedTableEntries(tableName),
					},
				},
			},
		},
	};
}
