/** @param {NS} ns */
export async function main(ns) {
	await getFile("/bin/mcp.js");
	await getFile("/bin/send.js");
	await getFile("/bin/try-rpc.js");

	await getFile("/include/formatting.js");
	await getFile("/include/io.js");
	await getFile("/include/rpc.js");
	await getFile("/include/server.js");
	await getFile("/include/mcp/servers.js");
	await getFile("/include/mcp/user.js");

	await getFile("/rpc/analyze.js");
	await getFile("/rpc/get-all-servers.js");
	await getFile("/rpc/hack-constants.js");
	await getFile("/rpc/infiltrate.js");
	await getFile("/rpc/kill-all.js");
	await getFile("/rpc/notifier.js");
	await getFile("/rpc/purchase-servers.js");
	await getFile("/rpc/root-server.js");
	await getFile("/rpc/server-details.js");
	await getFile("/rpc/todo-list.js");
	await getFile("/rpc/weaken-threads.js");
	await getFile("/rpc/weaken.js");

	await getFile("/rpc/idle/hack-exp.js");
	await getFile("/rpc/idle/share.js");
	await getFile("/rpc/servers/weaken.js");
}

async function getFile(path) {
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master" + path, path);
}
