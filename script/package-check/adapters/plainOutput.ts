import { stripVTControlCharacters } from "node:util";

export function plainOutput(text: string) {
	return stripVTControlCharacters(text).trim();
}
