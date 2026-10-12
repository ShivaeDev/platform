import { navigationHtml as renderNavigation } from "#browser/navigation/html.ts";
import { setupHandoffs } from "#client/handoffs/setup.ts";
import { resolvedDocumentFailure as documentFailure } from "#client/page/resolvedDocumentFailure.ts";
import { attachResponses as attachResponseForm } from "#client/responses/attach.ts";
import { setupResponses } from "#client/responses/setup.ts";

export const navigationHtml = renderNavigation;

if (typeof window !== "undefined" && typeof document !== "undefined") {
	setupResponses();
	setupHandoffs();
}

import { session as ownedSession } from "./session.ts";

export const session = ownedSession;

import { remember as retain } from "#client/reconcile/signature.ts";
import { swap as reconcile } from "#client/reconcile/swap.ts";
export const remember = retain;
export const swap = reconcile;

import { legacyRuntime as loadLegacy } from "./legacyRuntime.ts";
export const legacyRuntime = loadLegacy;

export const attachResponses = attachResponseForm;
export const resolvedDocumentFailure = documentFailure;
