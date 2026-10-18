import type { ComponentType } from "react";
import type { WorkProjection } from "#browser/views/schema.ts";
import { WorkNow } from "#client/react/WorkNow.tsx";
import { nowFleet, nowWork } from "./nowWork.ts";
import { screenStory } from "./screenStory.ts";
import { componentScreen, screenFleet } from "./screenTraits.ts";

export function nowScreen(count = 6, View: ComponentType<{ readonly data: WorkProjection }> = WorkNow) {
	return screenStory.traits(screenFleet(nowFleet(count)), componentScreen(<View data={nowWork(count)} />));
}
