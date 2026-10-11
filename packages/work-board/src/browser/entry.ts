import { setupHandoffs } from "#browser/handoffs/setup.ts";
import { navigationHtml as renderNavigation } from "#browser/navigation/html.ts";
import { setupResponses } from "#browser/responses/setup.ts";

export const navigationHtml = renderNavigation;

if (typeof window !== "undefined" && typeof document !== "undefined") {
	setupResponses();
	setupHandoffs();
}

import { session as ownedSession } from "./session.ts";

export const session = ownedSession;
