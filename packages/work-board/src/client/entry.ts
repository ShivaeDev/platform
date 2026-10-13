import { navigationHtml as renderNavigation } from "#browser/navigation/html.ts";
import { resolvedDocumentFailure as documentFailure } from "#client/page/resolvedDocumentFailure.ts";

export const navigationHtml = renderNavigation;

import { session as ownedSession } from "./session.ts";

export const session = ownedSession;

import { remember as retain } from "#client/reconcile/signature.ts";
import { swap as reconcile } from "#client/reconcile/swap.ts";
export const remember = retain;
export const swap = reconcile;

import { legacyRuntime as loadLegacy } from "./legacyRuntime.ts";
export const legacyRuntime = loadLegacy;

export const resolvedDocumentFailure = documentFailure;
