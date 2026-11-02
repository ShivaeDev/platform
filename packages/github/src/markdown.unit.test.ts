import { expect, it } from "vitest";
import { codeSpan, details, plainText, tableCell } from "./markdown.ts";

it("uses a fence longer than every hostile backtick run", () => {
	expect(codeSpan("a`b``c``` @team <script> 😀")).toBe("````a`b``c``` @team <script> 😀````");
	expect(codeSpan("`edge`")).toBe("`` `edge` ``");
	expect(codeSpan(" padded ")).toBe("`  padded  `");
	expect(codeSpan("   ")).toBe("`   `");
	expect(codeSpan("")).toBe("");
	expect(codeSpan("one\r\ntwo\rthree\nfour")).toBe("`one two three four`");
});

it("renders HTML, mentions, references, links and Markdown punctuation as literal text", () => {
	expect(plainText("<b>@org/team</b> #123 [x](https://a.test) ![img](x) &copy; ` * _ ~ \\ 😀")).toBe(
		"&#60;b&#62;&#64;&#8203;org&#47;team&#60;&#47;b&#62; &#35;&#8203;123 &#91;x&#93;&#40;https&#58;&#47;&#47;a&#46;test&#41; &#33;&#91;img&#93;&#40;x&#41; &#38;copy&#59; &#96; &#42; &#95; &#126; &#92; 😀",
	);
	expect(plainText("www.example.com user@example.com owner/repo#123")).toBe(
		"www&#46;example&#46;com user&#64;&#8203;example&#46;com owner&#47;repo&#35;&#8203;123",
	);
});

it("keeps pipes and line endings inside one table cell in text and code", () => {
	const text = "a|b\r\n@team\r<script>\n`x` 😀";
	expect(tableCell(text)).toBe("a&#124;b &#64;&#8203;team &#60;script&#62; &#96;x&#96; 😀");
	expect(tableCell(text, "code")).toBe("``a\\|b @team <script> `x` 😀``");
	expect(tableCell("\\|\u2028x\u2029y", "code")).toBe("`\\\\| x y`");
});

it("escapes closing tags, injected HTML and entities in both details text inputs", () => {
	expect(details('</summary></details><img src=x onerror="alert(1)">', '</details><script>alert("x")</script> &lt;b&gt;')).toBe(
		"<details>\n<summary>&#60;&#47;summary&#62;&#60;&#47;details&#62;&#60;img src&#61;x onerror&#61;&#34;alert&#40;1&#41;&#34;&#62;</summary>\n\n&#60;&#47;details&#62;&#60;script&#62;alert&#40;&#34;x&#34;&#41;&#60;&#47;script&#62; &#38;lt&#59;b&#38;gt&#59;\n\n</details>",
	);
});

it("preserves Unicode and line endings while escaping Markdown in details", () => {
	expect(details("😀 @team", "first\n\n#123 `code` [link](url)\r\n終")).toBe(
		"<details>\n<summary>😀 &#64;&#8203;team</summary>\n\nfirst\n\n&#35;&#8203;123 &#96;code&#96; &#91;link&#93;&#40;url&#41;\r\n終\n\n</details>",
	);
	expect(details("", "")).toBe("<details>\n<summary></summary>\n\n\n\n</details>");
});
