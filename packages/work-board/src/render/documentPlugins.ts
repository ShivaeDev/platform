import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";
import { callouts } from "./callouts.ts";
import { questionnaireDocuments } from "./questionnaireDocuments.ts";
import { visualDocuments } from "./visualDocuments.ts";

export const documentPlugins: PluggableList = [remarkGfm, remarkDirective, questionnaireDocuments, visualDocuments, callouts];
