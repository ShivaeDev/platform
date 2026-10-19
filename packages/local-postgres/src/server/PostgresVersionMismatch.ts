export class PostgresVersionMismatch extends Error {
	readonly _tag = "PostgresVersionMismatch";
	readonly expectedVersion = "18.6";
	readonly observedVersion: string | undefined;

	constructor(observedVersion: string | undefined) {
		super("Expected local PostgreSQL 18.6. Check the existing service; setup never removes containers or data.");
		this.observedVersion = observedVersion;
	}
}
