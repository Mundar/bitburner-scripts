/** @param {NS} ns */
export async function main(ns) {
	await getFile(ns, "/bin/mcp.js");
	await getFile(ns, "/bin/send.js");
	await getFile(ns, "/bin/try-rpc.js");

	await getFile(ns, "/include/formatting.js");
	await getFile(ns, "/include/io.js");
	await getFile(ns, "/include/rpc.js");
	await getFile(ns, "/include/server.js");

	await getFile(ns, "/include/mcp/servers.js");
	await getFile(ns, "/include/mcp/user.js");

	await getFile(ns, "/rpc/analyze.js");
	await getFile(ns, "/rpc/get-all-servers.js");
	await getFile(ns, "/rpc/grow.js");
	await getFile(ns, "/rpc/grow-threads.js");
	await getFile(ns, "/rpc/hack.js");
	await getFile(ns, "/rpc/hack-threads.js");
	await getFile(ns, "/rpc/hack-constants.js");
	await getFile(ns, "/rpc/infiltrate.js");
	await getFile(ns, "/rpc/kill-all.js");
	await getFile(ns, "/rpc/notifier.js");
	await getFile(ns, "/rpc/purchase-servers.js");
	await getFile(ns, "/rpc/root-server.js");
	await getFile(ns, "/rpc/server-details.js");
	await getFile(ns, "/rpc/todo-list.js");
	await getFile(ns, "/rpc/wait.js");
	await getFile(ns, "/rpc/weaken-threads.js");
	await getFile(ns, "/rpc/weaken.js");

	await getFile(ns, "/rpc/idle/hack-exp.js");
	await getFile(ns, "/rpc/idle/share.js");

	await getFile(ns, "/rpc/servers/hack.js");

	await getFile(ns, "/rpc/services/corporation.js");
}

async function getFile(ns, path) {
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master" + path, path);
}
