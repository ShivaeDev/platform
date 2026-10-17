export async function domNavigate(url: string | URL = window.location.href): Promise<Response> {
	const response = await window.fetch(new URL(url, window.location.href), { credentials: "include" });
	const html = await response.clone().text();
	window.location.href = response.url;
	document.open();
	document.write(html);
	document.close();
	return response;
}
