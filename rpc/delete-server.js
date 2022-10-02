/** @param {NS} ns */
import {RPC} from "/include/rpc.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	const server_name = "maeloch-" + rpc.task.server_num;
	if(ns.serverExists(server_name)) {
		const max_ram = ns.getServerMaxRam(server_name);
		if(await ns.prompt("Are you sure you want to delete " + server_name + " (" + max_ram + " GB)", { type: "boolean" })) {
			ns.deleteServer(server_name);
		}
	}

	await rpc.exit();
}
