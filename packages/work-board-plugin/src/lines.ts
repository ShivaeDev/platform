import type { WorkboardBoard } from "#types/index.d.ts";
import type { RpcReply } from "./rpc.ts";

const START_COMMAND = "npx @shivaedev/work-board .work";

export function waitingLine(state: Exclude<WorkboardBoard, { kind: "ready" }>): string {
	if (state.kind === "none") {
		return `This session's folder has no Work Board: no .work folder in ${state.cwd} or above it. Start one with: ${START_COMMAND}`;
	}
	if (state.kind === "down") {
		return `The Work Board for ${state.directory} isn't running. Start it there: ${START_COMMAND}`;
	}
	if (state.kind === "error") {
		return state.message;
	}
	return "Loading the Work Board…";
}

export function refusedLine(response: RpcReply, directory: string): string {
	return `The Work Board for ${directory} refused the request (${response.status}): ${response.text.trim()}`;
}

export function silentLine(directory: string): string {
	return `The Work Board for ${directory} did not answer with its RPC stream.`;
}

export function formatAge(ms: number | null): string {
	if (ms === null) {
		return "?";
	}
	const minutes = Math.floor(ms / 60_000);
	if (minutes < 1) {
		return "<1m";
	}
	if (minutes < 60) {
		return `${minutes}m`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 48) {
		return `${hours}h`;
	}
	return `${Math.floor(hours / 24)}d`;
}

export function clip(line: string, columns: number): string {
	const flat = line.replace(/\s+/gu, " ").trim();
	return flat.length <= columns ? flat : `${flat.slice(0, Math.max(0, columns - 1))}…`;
}

export function updatedLabel(updatedAt: number | null, now: number): string | null {
	if (updatedAt === null) {
		return null;
	}
	const ms = Math.max(0, now - updatedAt);
	return ms < 60_000 ? `updated ${Math.floor(ms / 1000)}s ago` : `updated ${formatAge(ms)} ago`;
}

export function prLabel(url: string): string {
	const number = /\/pull\/(?<number>\d+)/u.exec(url)?.groups?.number;
	return number === undefined ? "PR" : `#${number}`;
}
