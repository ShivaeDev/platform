import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { Cause, Queue } from "effect";
import { BackendUnavailable } from "@shivaedev/agent/failures.ts";
import type { InputQueue } from "#adapters/InputQueue.ts";
import type { Delivery } from "#adapters/sessionLanes.ts";
import type { Repair } from "#adapters/workflowAdoption.ts";

export async function consumeSession(
	live: AsyncIterable<SDKMessage>,
	input: InputQueue,
	queue: Queue.Queue<Delivery, BackendUnavailable | Cause.Done>,
	deliver: (delivery: Delivery) => void,
	repair: () => Promise<Repair | undefined>,
	stopped: () => boolean,
): Promise<void> {
	try {
		for await (const message of live) {
			if (stopped()) {
				break;
			}
			deliver({ kind: "frame", message });
		}
		const recovered = await repair();
		if (!stopped() && recovered !== undefined) {
			deliver({ kind: "repair", repair: recovered });
		}
	} catch (error) {
		if (!stopped()) {
			Queue.failCauseUnsafe(queue, Cause.fail(new BackendUnavailable({ backend: "claude-code", message: String(error) })));
		}
	} finally {
		input.close();
		Queue.endUnsafe(queue);
	}
}
