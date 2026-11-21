import { Context, Data } from "effect";

export type HandOverMode = "none" | "gives projects to bob" | "fails after giving projects to bob";

export class HandOverRefused extends Data.TaggedError("HandOverRefused") {}

// The story's traits choose what the application's hand-over does before the person asks for the deletion.
export class HandOverPlan extends Context.Service<HandOverPlan, { mode: HandOverMode; receiver: string }>()(
	"@shivaedev/identity/test/HandOverPlan",
) {}
