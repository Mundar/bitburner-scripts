/** @param {NS} ns */
export async function main(ns) {
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/bin/mcp.js", "/bin/mcp.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/bin/send.js", "/bin/send.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/bin/try-rpc.js", "/bin/try-rpc.js");

	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/include/formatting.js", "/include/formatting.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/include/rpc.js", "/include/rpc.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/include/mcp/io.js", "/include/mcp/io.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/include/mcp/servers.js", "/include/mcp/servers.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/include/mcp/user.js", "/include/mcp/user.js");

	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/rpc/get-all-servers.js", "/rpc/get-all-servers.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/rpc/infiltrate.js", "/rpc/infiltrate.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/rpc/kill-all.js", "/rpc/kill-all.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/rpc/purchase-servers.js", "/rpc/purchase-servers.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/rpc/root-server.js", "/rpc/root-server.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/rpc/server-details.js", "/rpc/server-details.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/rpc/todo-list.js", "/rpc/todo-list.js");

	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/rpc/idle/hack-exp.js", "/rpc/idle/hack-exp.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/rpc/idle/share.js", "/rpc/idle/share.js");

	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/root/share.js", "share.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/root/hack-exp.js", "hack-exp.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/root/weaken.js", "weaken.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/root/grow.js", "grow.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/root/hack.js", "hack.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/root/mcp-single.js", "mcp-single.js");
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/root/mcp-remote.js", "mcp-remote.js");
}
