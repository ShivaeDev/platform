import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";

export function screenRoles(tell: (line: string) => void) {
	return {
		roles: screenDriver({ act: (action) => act(action), root: () => document.body, tell }),
	};
}
