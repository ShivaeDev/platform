import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/screenDriver.ts";

export function screenRoles(tell: (line: string) => void) {
	return { ui: screenDriver({ act: (action) => act(action), pending: () => false, root: () => document.body, tell }) };
}
