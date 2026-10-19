import type { ComponentType } from "react";
import type { WorkProjection } from "#browser/views/schema.ts";
import { WorkNow } from "#client/react/WorkNow.tsx";
import { nowFleet, nowWork } from "./nowWork.ts";
import { screenStory } from "./screenStory.ts";
import { componentScreen } from "./screenTraits.ts";
import { screenFleet } from "./screenWorkspaceTraits.ts";

export function nowScreen(
	count = 6,
	View: ComponentType<{ readonly data: WorkProjection }> = WorkNow,
	fleet: Parameters<typeof screenFleet>[0] = nowFleet(count),
) {
	return screenStory.traits(screenFleet(fleet), componentScreen(<View data={nowWork(count)} />));
}
