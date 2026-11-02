import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import type { markdownElement } from "#adapters/markdownElement.ts";
import { callouts } from "./callouts.ts";
import { questionnaireDocuments } from "./questionnaireDocuments.ts";
import { visualDocuments } from "./visualDocuments.ts";

export function documentPlugins(questionActions?: ReadonlyMap<string, string>): PluggableList {
	return [remarkGfm, remarkDirective, [questionnaireDocuments, questionActions], visualDocuments, callouts];
}

type PluggableList = NonNullable<Parameters<typeof markdownElement>[1]["rehypePlugins"]>;
