import type { RuntimeConnection, RuntimeTransaction } from "@prisma-next/sql-runtime";

export type SettledConnection = Pick<RuntimeConnection, "destroy" | "release">;
export type SettledTransaction = Pick<RuntimeTransaction, "commit" | "rollback">;

interface Settled {
	readonly connection: SettledConnection;
	readonly transaction: SettledTransaction;
}

function runtimeFailure(code: string, cause: unknown, details?: Readonly<Record<string, unknown>>): Error & { readonly code: string } {
	return Object.assign(new Error(code, { cause }), { code, ...details });
}

class ConnectionDisposal {
	disposed = false;
	private readonly connection: SettledConnection;

	constructor(connection: SettledConnection) {
		this.connection = connection;
	}

	async destroy(reason: unknown): Promise<void> {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		await this.connection.destroy(reason).catch(() => undefined);
	}
}

async function commit({ transaction }: Settled, disposal: ConnectionDisposal): Promise<unknown> {
	try {
		await transaction.commit();
		return undefined;
	} catch (commitError) {
		await transaction.rollback().catch(() => disposal.destroy(commitError));
		return runtimeFailure("RUNTIME.TRANSACTION_COMMIT_FAILED", commitError);
	}
}

async function rollback({ transaction }: Settled, disposal: ConnectionDisposal): Promise<unknown> {
	try {
		await transaction.rollback();
		return undefined;
	} catch (rollbackError) {
		await disposal.destroy(rollbackError);
		return runtimeFailure("RUNTIME.TRANSACTION_ROLLBACK_FAILED", rollbackError);
	}
}

async function release({ connection }: Settled, disposal: ConnectionDisposal, failure: unknown): Promise<void> {
	if (disposal.disposed) {
		return;
	}
	try {
		await connection.release();
	} catch (releaseError) {
		await disposal.destroy(releaseError);
		throw failure === undefined ? releaseError : runtimeFailure("RUNTIME.TRANSACTION_RELEASE_FAILED", failure, { releaseError });
	}
}

export const settleConnection = async (settled: Settled, commitTransaction: boolean): Promise<void> => {
	const disposal = new ConnectionDisposal(settled.connection);
	const failure = commitTransaction ? await commit(settled, disposal) : await rollback(settled, disposal);
	await release(settled, disposal, failure);
	if (failure !== undefined) {
		throw failure;
	}
};
