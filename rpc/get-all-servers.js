/** @param {NS} ns */
import {RPC} from "/include/rpc.js"; 

export async function main(ns) {
	var rpc = new RPC(ns);

	var hosts = new Map();

	var remaining_hosts = ["home"];
	var home_data = serverData(ns, "home");
	home_data.location = [];
	hosts.set("home", home_data);
	while(0 < remaining_hosts.length) {
		const server = remaining_hosts.shift();
		const me = hosts.get(server);
		var location = me.location.concat([server]);
		var new_scan = ns.scan(server);
		me.children = [];
		while(0 < new_scan.length) {
			const host = new_scan.shift();
			if(!hosts.has(host)) {
				remaining_hosts.push(host);
				me.children.push(host);
				var server_data = serverData(ns, host);
				server_data.location = location;
				server_data.links = ns.scan(host);
				hosts.set(host, server_data);
			}
		}
	}
	rpc.task.servers = Array.from(hosts.values());

	await rpc.exit();
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
