import { disconnectRecovery } from "#test/disconnectRecovery.ts";
import { postgresTests } from "#test/postgres.ts";

for (const delayedReads of [0, 1, 4]) {
	postgresTests("live", "isolated")(
		`a disconnected submission retains one operation and never submits a second turn: delayed reads=${delayedReads}`,
		() => disconnectRecovery(delayedReads),
	);
}
