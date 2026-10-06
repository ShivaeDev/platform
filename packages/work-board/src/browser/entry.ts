import { setupHandoffs } from "#browser/handoffs/setup.ts";
import { setupResponses } from "#browser/responses/setup.ts";

if (typeof window !== "undefined" && typeof document !== "undefined") {
	setupResponses();
	setupHandoffs();
}

import { session as ownedSession } from "./session.ts";

export const session = ownedSession;
