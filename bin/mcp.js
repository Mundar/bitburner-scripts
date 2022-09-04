/** @param {NS} ns */
import {handle_messages} from "include/mcp/messages.js";
import {added_unused_server, process_unassigned_targets} from "include/mcp/idle.js";
import {remote_servers} from "include/mcp/spider.js";

export async function main(ns) {
	if("home" != ns.getHostname()) { ns.tprint("ERROR: The Master Control Program should only be run on home!"); ns.exit(); }

	ns.tail();

	ns.disableLog("disableLog");
	ns.disableLog("sleep");
	ns.disableLog("getHackingLevel");

	var s = createState(ns);
	while(true) {
		if(s.player.skills.hacking != s.current_hacking_level) {
			ns.print("Detected hacking level change from " + s.current_hacking_level + " to " + s.player.skills.hacking);
			s.current_hacking_level = s.player.skills.hacking;
		}
		process_unrooted(s);
		if(s.added_unused) {
			await added_unused_server(s);
		}
		if(s.added_target) {
			await process_unassigned_targets(s);
		}
		await handle_messages(s);
		await ns.sleep(1000);
	}
}

function reset_server(ns, server_list) {
	for(var i = 0; i < server_list.length; i++) {
		const host = server_list[i];
		const server = ns.getServer(host);
		if(server.hasAdminRights) {
			ns.killall(host);
		}
	}
}

function createState(ns) {
	var remote = remote_servers(ns);
	var unrooted = [];
	for (const [key, serv] of remote.entries()) {
		unrooted.push(key);
	}
	unrooted.reverse();
	reset_server(ns, unrooted);
	var ps_unused =  ns.getPurchasedServers();
	reset_server(ns, ps_unused);
	return {
		rooted: [],
		rs_unused: [],
		rs_idle: [],
		rs_weaken: [],
		rs_useless: [],
		unrooted: unrooted,
		ps_unused: ps_unused,
		ps_idle: [],
		ps_hacking: [],
		unassigned_targets: [],
		targets: new Map(),
		needed_cracks: [],
		current_hacking_level: 0,
		next_hacking_level: 1,
		added_unused: false,
		added_target: false,
		idle_script: "",
		idle_ram: 0,
		home_reserved: 16,
		home_idle: 0,
		home_idle_script: "",
		port: ns.getPortHandle(20),
		remote: remote,
		player: ns.getPlayer(),
		ns: ns,
	};
}

function create_constants(ns) {
	return {
		ns: ns,
		servers: ns.read("other-servers.txt").split("\n"),
	}
}

function process_unrooted(s) {
	var process = false;
	if(0 == s.unrooted.length) { return; }	// If there is nothing to do, exit.
	else if(0 < s.needed_cracks.length) {
		// If we are waiting on a program to be installed, check to see if one of them was installed.
		for(var i = 0; i < s.needed_cracks.length; i++) {
			if(s.ns.fileExists(s.needed_cracks[i], "home")) {
				s.needed_cracks = 0;
				process = true;	// One of the needed files was acquired.
			}
		}
	}
	else if(s.player.skills.hacking >= s.next_hacking_level) {
		process = true;
	}

	if(process) {
		var not_done = true;
		while((not_done) && (0 < s.unrooted.length)) {
			const candidate_server = s.unrooted.pop();
			const server = s.ns.getServer(candidate_server);
			if(root_server(s, candidate_server)) {
				s.rooted.push(candidate_server);
				if(0 < server.maxRam) {
					s.rs_unused.push(candidate_server);
					s.added_unused = true;
				}
				else {
					s.rs_useless.push(candidate_server);
				}
			}
			else {
				s.next_hacking_level = server.requiredHackingSkill;
				s.unrooted.push(candidate_server);
				not_done = false;
			}
		}
	}
}

function root_server(s, server) {
	var server = s.ns.getServer(server);
    var required_level = server.requiredHackingSkill;
    if (s.player.skills.hacking < required_level) {
        s.ns.print("Our hacking level is too low for server " + server.hostname + " (" + required_level + ")");
		s.next_hacking_level = required_level;
        return false;
    }
    if (!server.hasAdminRights) {
        const ports = server.numOpenPortsRequired;

		var open_ports = 0;
		if(server.sshPortOpen) { open_ports += 1; }
        else if ((open_ports < ports) && (s.ns.fileExists("BruteSSH.exe", "home"))) {
            s.ns.brutessh(server.hostname);
			open_ports += 1;
        }
		if(server.ftpPortOpen) { open_ports += 1; }
        else if ((open_ports < ports) && (s.ns.fileExists("FTPCrack.exe", "home"))) {
            s.ns.ftpcrack(server.hostname);
			open_ports += 1;
        }
		if(server.smtpPortOpen) { open_ports += 1; }
        else if ((open_ports < ports) && (s.ns.fileExists("relaySMTP.exe", "home"))) {
            s.ns.relaysmtp(server.hostname);
			open_ports += 1;
        }
		if(server.httpPortOpen) { open_ports += 1; }
        else if ((open_ports < ports) && (s.ns.fileExists("HTTPWorm.exe", "home"))) {
            s.ns.httpworm(server.hostname);
			open_ports += 1;
        }
		if(server.sqlPortOpen) { open_ports += 1; }
        else if ((open_ports < ports) && (s.ns.fileExists("SQLInject.exe", "home"))) {
            s.ns.sqlinject(server.hostname);
			open_ports += 1;
        }
        if (open_ports >= ports) {
            s.ns.nuke(server.hostname);
        }
        else {
            s.ns.print("Server " + server.hostname + " has " + open_ports + " of " + ports + " ports open");
			var all_cracks = ["SQLInject.exe", "HTTPWorm.exe", "relaySMTP.exe", "FTPCrack.exe", "BruteSSH.exe"];
			s.needed_cracks = [];
			while(0 < all_cracks.length) {
				const crack = all_cracks.pop();
				if(!s.ns.fileExists(crack, "home")) {
					s.needed_cracks.push(crack);
				}
			}
            return false;
        }
    }
    return true;
}
