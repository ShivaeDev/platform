import { boardDispatchRetry, boardReadExhaustion, boardReadRecovery } from "#test/boardReadRetry.ts";
import { postgresTests } from "#test/postgres.ts";

for (const source of [".", "0.md"]) {
	postgresTests("live", "isolated")(`an incomplete Board read retries without losing execution: ${source}`, () => boardReadRecovery(source));
}
postgresTests("live", "isolated")("five incomplete Board reads retain one decision and publish it when the Board returns", boardReadExhaustion);

postgresTests("live", "isolated")("an incomplete Board read before dispatch waits for its deadline and submits once", boardDispatchRetry);
