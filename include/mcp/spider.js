/** @param {NS} ns */
export function remote_servers(ns) {
	var visited_hosts = new Map();
	// First, lets fill in the data for all purchased servers.
	var purchased_servers = ns.getPurchasedServers();
	while(0 < purchased_servers.length) {
		let pserv = purchased_servers.pop();
		visited_hosts.set(pserv, serverData(ns, pserv, ["home"]));
	}
	// If darkweb exsist, ignore it.
	if(ns.serverExists("darkweb")) {
		visited_hosts.set("darkweb", serverData(ns, "darkweb", ["home"]));
	}
    var levels = new Map();
	var remaining_hosts = ["home"];
	var sorted_hosts = [];
	visited_hosts.set("home", serverData(ns, "home", []));
	while(0 < remaining_hosts.length) {
		const server = remaining_hosts.shift();
		const me = visited_hosts.get(server);
		var location = me.location.concat([server]);
		let new_scan = ns.scan(server);
		var children = [];
		while(0 < new_scan.length) {
			const host = new_scan.shift();
			if(!visited_hosts.has(host)) {
				remaining_hosts.push(host);
				children.push(host);
				sorted_hosts.push(host);
				const server_data = serverData(ns, host, location);
				const level = server_data.server.requiredHackingSkill;
				visited_hosts.set(host, server_data);
				if (levels.has(level)) {
					const old_level = levels.get(level);
					old_level.push(host);
					levels.set(level, old_level);
				}
				else {
					levels.set(level, [host]);
				}
			}
		}
		me.children = children;
	}
	var keys_by_width = [[],[],[],[]];
	for(const key of levels.keys()) {
		const index = String(key).length-1;
		if((0 <= index) && (4 > index)) {
			keys_by_width[index].push(key);
		}
		else {
			ns.tprint("Invalid width for key " + key + "(" + (index+1) + ")");
		}
	}
	for(var i = 0; 4 > i; ++i) {
		keys_by_width[i].sort();
	}
	const level_keys = keys_by_width.flat();
	const output_map = new Map();
	for (var i = 0; i < level_keys.length; i++) {
		const lev = level_keys[i];
		var hosts = levels.get(lev);
		hosts.sort();
		for(var j = 0; j < hosts.length; j++) {
			const server_data = visited_hosts.get(hosts[j]);
			output_map.set(hosts[j], server_data);
		}
	}
	return output_map;
}

function serverData(ns, new_server, location) {
	const server = ns.getServer(new_server)
	return {
		server: server,
		location: location,
	}
}
