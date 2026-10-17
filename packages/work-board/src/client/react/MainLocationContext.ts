import { createContext, useContext } from "react";
import { emptyMainLocation } from "./mainLocation.ts";

export const MainLocationContext = createContext(emptyMainLocation);

export function useMainLocation() {
	return useContext(MainLocationContext);
}
