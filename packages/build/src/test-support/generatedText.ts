// Reads the generated file the way a reviewer does: which wire entry an operation has and where its classes come from.

function wireLine(text: string, operation: string): string {
	return text.split("\n").find((line) => line.startsWith(`\t${operation}: { rejections: `)) ?? "";
}

export function successOf(text: string, operation: string): string {
	return /success: (?<success>.*) \},$/u.exec(wireLine(text, operation))?.groups?.success ?? "no wire entry";
}

export function rejectionTagsOf(text: string, operation: string): readonly string[] {
	const listed = /rejections: \{ (?<listed>[^}]*) \}/u.exec(wireLine(text, operation))?.groups?.listed ?? "";
	return listed === "" ? [] : listed.split(", ").map((entry) => entry.split(": ")[0] ?? entry);
}

// The module the generated file imports an operation's rejection class from.
export function rejectionSourceOf(text: string, operation: string, tag: string): string {
	const listed = /rejections: \{ (?<listed>[^}]*) \}/u.exec(wireLine(text, operation))?.groups?.listed ?? "";
	const entry = listed.split(", ").find((each) => each === tag || each.startsWith(`${tag}: `));
	const local = entry?.split(": ")[1] ?? entry;
	const line = text.split("\n").find((each) => each.startsWith("import ") && new RegExp(`[{,] (?:\\w+ as )?${local}[,} ]`, "u").test(each));
	return /from "(?<source>[^"]+)";$/u.exec(line ?? "")?.groups?.source ?? `no import of ${tag}`;
}
