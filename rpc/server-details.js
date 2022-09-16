/** @param {NS} ns */
import {RPC} from "/include/rpc.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	rpc.task.server = serverData(ns, rpc.task.target)

	rpc.exit();
}

export function serverData(ns, new_server) {
	const server = ns.getServer(new_server);
	return {
		hostname: new_server,
		level: server.requiredHackingSkill,
		cores: server.cpuCores,
		ports: server.numOpenPortsRequired,
		max_ram: server.maxRam,
		max_money: server.moneyMax,
		purchased: server.purchasedByPlayer,
		root_access: server.hasAdminRights,
		backdoor: server.backdoorInstalled,
	}
}