import type { DecisionCode } from "#DecisionCode.ts";

export const recoveryCapacityCases = [
	...(["session", "turn"] as const).map((call) => ({
		call,
		code: "session-queue-full" as const,
		name: `reworded ${call} rejection preserves automatic backoff after restart`,
	})),
	{
		call: "quota" as const,
		code: "provider-quota-unavailable" as const,
		name: "reworded admission denial preserves quota waiting and resumes after restart",
	},
] satisfies readonly { call: "session" | "turn" | "quota"; code: DecisionCode; name: string }[];
