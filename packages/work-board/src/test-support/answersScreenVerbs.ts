import { answerCardActions } from "./answerCardActions.ts";
import { answerCardVerbs } from "./answerCardVerbs.ts";
import { answerDraftVerbs } from "./answerDraftVerbs.ts";
import { closedDraftVerbs } from "./closedDraftVerbs.ts";
import { decisionOutcomeVerbs } from "./decisionOutcomeVerbs.ts";
import { distinctVerbs } from "./distinctVerbs.ts";
import { handoffFormVerbs } from "./handoffFormVerbs.ts";
import { itemWaitingVerbs } from "./itemWaitingVerbs.ts";
import { liveFormVerbs } from "./liveFormVerbs.ts";
import { preferenceVerbs } from "./preferenceVerbs.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { todayAnswerVerbs } from "./todayAnswerVerbs.ts";

export function answersScreenVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	return distinctVerbs(
		answerCardVerbs(engine, tell),
		answerCardActions(engine, tell),
		answerDraftVerbs(engine, tell),
		closedDraftVerbs(engine, tell),
		decisionOutcomeVerbs(tell),
		handoffFormVerbs(engine, tell),
		itemWaitingVerbs(engine, tell),
		liveFormVerbs(engine, tell),
		preferenceVerbs(tell),
		todayAnswerVerbs(engine, tell),
	);
}
