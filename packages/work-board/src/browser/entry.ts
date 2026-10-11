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

import { remember as retain } from "#browser/reconcile/signature.ts";
import { swap as reconcile } from "#browser/reconcile/swap.ts";
export const remember = retain;
export const swap = reconcile;

import { legacyRuntime as loadLegacy } from "./legacyRuntime.ts";
export const legacyRuntime = loadLegacy;
