import { Data } from "effect";

export class PostgresListenerError extends Data.TaggedError("PostgresListenerError")<{
	readonly connectionSetting: string;
}> {
	override get message() {
		return `PostgreSQL change listener heartbeat timed out without receiving its own notification. Set ${this.connectionSetting} to a direct or session-mode connection to the application database.`;
	}
}
