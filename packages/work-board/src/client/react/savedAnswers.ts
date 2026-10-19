import * as Atom from "effect/reactivity/Atom";
import type { Navigation } from "#browser/Navigation.ts";
import type { InboxProjection } from "#browser/views/schema.ts";

export interface SavedAnswer {
	readonly inbox: InboxProjection;
	readonly key: string;
	readonly navigation: Navigation | undefined;
}

// Each read that a saved answer predates leaves its ask out until that read refreshes, so Today and every count agree at once.
export const savedAnswers = Atom.make<readonly SavedAnswer[]>([]).pipe(Atom.keepAlive);
