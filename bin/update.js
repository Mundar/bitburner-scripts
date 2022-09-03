/** @param {NS} ns */
export async function main(ns) {
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/bin/mcp.js", "/bin/mcp.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/bin/send.js", "/bin/send.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/include/formatting.js", "/include/formatting.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/include/mcp/idle.js", "/include/mcp/idle.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/include/mcp/messages.js", "/include/mcp/messages.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/include/mcp/spider.js", "/include/mcp/spider.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/root/share.js", "share.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/root/hack-exp.js", "hack-exp.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/root/weaken.js", "weaken.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/root/grow.js", "grow.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/root/hack.js", "hack.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/root/mcp-single.js", "mcp-single.js");
}
