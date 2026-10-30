import { Effect } from "effect";
import type { FakeHttpFault, FakeHttpRequest, FakeHttpScript, FakeHttpScriptOptions } from "#fakeHttpService.ts";
import { fakeHttpSelection } from "#internal/fakeHttpSelection.ts";

export function fakeHttpScripts(tell: (line: string) => void) {
	const scripts = new Set<{
		selection: ReturnType<typeof fakeHttpSelection>;
		fault: FakeHttpFault;
		options: FakeHttpScriptOptions;
	}>();
	return {
		clear: () => scripts.clear(),
		make: (route: string, fault: FakeHttpFault, options: FakeHttpScriptOptions = {}): FakeHttpScript => {
			const selection = fakeHttpSelection(route, options);
			const script = { fault, options, selection };
			scripts.add(script);
			tell(`fake HTTP ${selection.label} will fault ${fault.kind} ${options.phase ?? "before"} reply ${options.repeat ? "until lifted" : "once"}`);
			return {
				lift: Effect.sync(() => {
					if (scripts.delete(script)) {
						tell(`fake HTTP ${selection.label} fault ${fault.kind} lifted`);
					}
				}),
			};
		},
		take: (route: string, request: FakeHttpRequest, phase: "before" | "after") => {
			for (const script of scripts) {
				if ((script.options.phase ?? "before") === phase && script.selection.matches(route, request)) {
					if (!script.options.repeat) {
						scripts.delete(script);
					}
					return script.fault;
				}
			}
			return undefined;
		},
	};
}
