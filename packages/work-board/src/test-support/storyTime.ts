import { DateTime } from "effect";

export const STORY_NOW = Date.UTC(2026, 10, 3, 12);
export const storyClock = DateTime.makeUnsafe(STORY_NOW);
