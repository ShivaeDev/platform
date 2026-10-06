import { setupResponses } from "#browser/responses/setup.ts";

if (typeof window !== "undefined" && typeof document !== "undefined") {
	setupResponses();
}

import { session as ownedSession } from "./session.ts";

export const session = ownedSession;
