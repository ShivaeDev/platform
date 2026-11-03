import type { RunEvent } from "@shivaedev/agent/events.ts";
export type Origin = NonNullable<RunEvent["origin"]>;
export type RawPayload = NonNullable<RunEvent["raw"]>;
export type ChildOutcome = Extract<
	RunEvent,
	{
		type: "child.ended";
	}
>["outcome"];
