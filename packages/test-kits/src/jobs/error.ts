import { Data, Duration, type Redacted } from "effect";

export class PgBossTestingError extends Data.TaggedError("PgBossTestingError")<{
	readonly operation: string;
	readonly original: Redacted.Redacted<unknown>;
	readonly queue?: string | undefined;
}> {}

export class PgBossWaitError extends Data.TaggedError("PgBossWaitError")<{
	readonly lastSeen: string;
	readonly waitingFor: string;
	readonly within: Duration.Duration;
}> {
	override get message(): string {
		return `Gave up after ${Duration.format(this.within)} waiting until ${this.waitingFor}; last seen: ${this.lastSeen}`;
	}
}
