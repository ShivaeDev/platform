import { useRouterState } from "@tanstack/react-router";
import { Duration, Effect } from "effect";
import { useEffect, useState } from "react";
import { clockEffect } from "#client/react/adapters/clockEffect.ts";
import { useBoardClock } from "#client/react/FormContext.ts";
import type { MainLocation } from "./mainLocation.ts";
import { workspaceDestinations } from "./workspaceDestinations.ts";

export const PENDING_FEEDBACK_MS = 150;

type Destination = (typeof workspaceDestinations)[number]["view"];

export function useNavigationTarget() {
	return useRouterState({
		select: (state) => (state.status === "pending" && state.location.href !== state.resolvedLocation?.href ? state.location.pathname : undefined),
	});
}

export function useCurrentDestination(main: MainLocation): Destination | undefined {
	const target = useNavigationTarget();
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	if (target !== undefined) {
		return workspaceDestinations.find((destination) => destination.href === target)?.view;
	}
	return pathname === "/" ? "today" : workspaceDestinations.find((destination) => destination.view === main.view)?.view;
}

export function useNavigationPending() {
	const clock = useBoardClock();
	const target = useNavigationTarget();
	const [shown, setShown] = useState<string>();
	useEffect(() => {
		if (target === undefined) {
			return;
		}
		const stop = clockEffect(clock.sleep(Duration.millis(PENDING_FEEDBACK_MS)).pipe(Effect.andThen(Effect.sync(() => setShown(target)))));
		return () => {
			stop();
			setShown(undefined);
		};
	}, [clock, target]);
	return target !== undefined && shown === target;
}
