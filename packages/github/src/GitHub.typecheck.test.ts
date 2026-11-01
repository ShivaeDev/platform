import { Effect, Schema } from "effect";
import { expectTypeOf } from "vitest";
import type { CreateCheckRun } from "#checkRuns.ts";
import { GitHub, write } from "#GitHub.ts";

const deleted = write("DELETE", "/repos/acme/widgets/issues/comments/7");
const changed = write("PUT", "/repos/acme/widgets/issues/1/labels", { labels: ["ready"] }, Schema.Array(Schema.Struct({ name: Schema.String })));
expectTypeOf<Effect.Success<typeof deleted>>().toEqualTypeOf<void>();
expectTypeOf<Effect.Success<typeof changed>>().toEqualTypeOf<ReadonlyArray<{ readonly name: string }>>();

const completed: typeof CreateCheckRun.Type = { conclusion: "success", headSha: "abc", name: "Coverage", status: "completed" };
// @ts-expect-error Completed creates require a conclusion.
const missingConclusion: typeof CreateCheckRun.Type = { headSha: "abc", name: "Coverage", status: "completed" };

const invalidCreate = Effect.flatMap(GitHub, (github) => {
	// @ts-expect-error The service also requires a conclusion for completed creates.
	return github.createCheckRun("acme", "widgets", { headSha: "abc", name: "Coverage", status: "completed" });
});
// @ts-expect-error GitHub Apps cannot create an Actions-only status.
const waiting: typeof CreateCheckRun.Type = { headSha: "abc", name: "Coverage", status: "waiting" };
void [completed, missingConclusion, invalidCreate, waiting];
