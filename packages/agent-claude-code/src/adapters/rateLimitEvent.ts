import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import type { RawPayload } from "#protocol.ts";

type Info = Extract<
	SDKMessage,
	{
		type: "rate_limit_event";
	}
>["rate_limit_info"];
const STATUS = { allowed: "allowed", "allowed_warning": "warning", rejected: "rejected" } as const;
const WINDOWS = {
	"five_hour": { durationMinutes: 300 },
	overage: {},
	"seven_day": { durationMinutes: 10_080 },
	"seven_day_opus": { durationMinutes: 10_080, model: "opus" },
	"seven_day_overage_included": { durationMinutes: 10_080 },
	"seven_day_sonnet": { durationMinutes: 10_080, model: "sonnet" },
};
export function rateLimitEvent(
	raw: RawPayload,
	message: Extract<
		SDKMessage,
		{
			type: "rate_limit_event";
		}
	>,
): RunEvent {
	const info: Info = message.rate_limit_info;
	return {
		raw,
		status: STATUS[info.status],
		type: "rate.limit",
		windows:
			info.utilization === undefined
				? []
				: [
						{
							...(info.rateLimitType === undefined ? {} : WINDOWS[info.rateLimitType]),
							...(info.resetsAt === undefined ? {} : { resetsAt: info.resetsAt * 1000 }),
							usedPercent: Math.round(info.utilization * 100),
						},
					],
	};
}
