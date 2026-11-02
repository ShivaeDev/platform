import { Result } from "effect";
import { codeSpan, plainText, tableCell } from "#markdown.ts";
import { renderRows } from "#markdownRows.ts";

const HOSTILE = "`bad`` |\r\n<script>@org/team #123 [click](https://evil.test) 😀";
export const REPORT = `${plainText("<b>@team #123 [link](url)</b>")}\n\n${codeSpan(HOSTILE)}\n\n${Result.getOrThrow(renderRows([`| ${tableCell(HOSTILE)} | ${tableCell(HOSTILE, "code")} |`], { header: "| Name | Error |\n| --- | --- |" }))}`;
export const LONG_REPORT = Result.getOrThrow(renderRows(Array.from({ length: 20_000 }, (_, index) => `| test ${index} | failed |`)));
