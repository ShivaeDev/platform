export interface ClientLifecycle {
	readonly connect: () => PromiseLike<unknown>;
	readonly close: () => PromiseLike<void>;
}

export const acquireConnectedClient = async <A>(
	client: ClientLifecycle,
	initialize: () => A,
): Promise<A> => {
	try {
		await client.connect();
		return initialize();
	} catch (error) {
		await Promise.resolve(client.close()).catch(() => undefined);
		throw error;
	}
};

const reservedModelNames = new Set(["transaction"]);

export const assertAvailableModelNames = (
	modelNames: ReadonlyArray<string>,
): void => {
	for (const modelName of modelNames) {
		if (reservedModelNames.has(modelName)) {
			throw new TypeError(
				`Prisma model name conflicts with the database facade: ${modelName}`,
			);
		}
	}
};
