/** @param {NS} ns */
import {RPC} from "/include/rpc.js";

export async function main(ns) {
	ns.disableLog("sleep");
	ns.disableLog("getHackingLevel");
	var rpc = new RPC(ns);

	rpc.task.success = false;
	await root_server(ns, rpc);

	await rpc.exit();
}

async function root_server(ns, rpc) {
	if(!ns.serverExists(rpc.task.target)) {
		rpc.task.failure_message = "Server " + rpc.task.target + " doesn't exist";
		rpc.task.reason = "invalid";
		rpc.task.success = false;
		return;
	}
	var required_level = ns.getServerRequiredHackingLevel(rpc.task.target);
	if (ns.getHackingLevel() < required_level) {
		var previous_hacking_level = ns.getHackingLevel();
		var update_msg = {
			host: rpc.task.host,
			target: rpc.task.target,
			action: "root-status-update",
			reason: "Waiting for hacking level to increase to " + required_level,
		};
		await rpc.send(update_msg);
		await ns.sleep(10000);
		while(ns.getHackingLevel() < required_level) {
			if(ns.getHackingLevel() != previous_hacking_level) {
				ns.print("Hacking level increased from " + previous_hacking_level + " to " + ns.getHackingLevel());
				previous_hacking_level = ns.getHackingLevel();
			}
			await ns.sleep(10000);
		}
	}
	if (!ns.hasRootAccess(rpc.task.target)) {
		const ports = ns.getServerNumPortsRequired(rpc.task.target);

		var send_update = true;
		var ssh_opened = false;
		var ftp_opened = false;
		var smtp_opened = false;
		var http_opened = false;
		var sql_opened = false;
		var open_ports = 0;
		while(open_ports < ports) {
			open_ports = 0;
			if(ssh_opened) { open_ports += 1; }
			else if ((open_ports < ports) && (ns.fileExists("BruteSSH.exe", "home"))) {
				ns.brutessh(rpc.task.target);
				ssh_opened = true;
				open_ports += 1;
			}
			if(ftp_opened) { open_ports += 1; }
			else if ((open_ports < ports) && (ns.fileExists("FTPCrack.exe", "home"))) {
				ns.ftpcrack(rpc.task.target);
				ftp_opened = true;
				open_ports += 1;
			}
			if(smtp_opened) { open_ports += 1; }
			else if ((open_ports < ports) && (ns.fileExists("relaySMTP.exe", "home"))) {
				ns.relaysmtp(rpc.task.target);
				smtp_opened = true;
				open_ports += 1;
			}
			if(http_opened) { open_ports += 1; }
			else if ((open_ports < ports) && (ns.fileExists("HTTPWorm.exe", "home"))) {
				ns.httpworm(rpc.task.target);
				http_opened = true;
				open_ports += 1;
			}
			if(sql_opened) { open_ports += 1; }
			else if ((open_ports < ports) && (ns.fileExists("SQLInject.exe", "home"))) {
				ns.sqlinject(rpc.task.target);
				sql_opened = true;
				open_ports += 1;
			}
			if(open_ports < ports) {
				if(send_update) {
					var update_msg = {
						host: rpc.task.host,
						target: rpc.task.target,
						action: "root-status-update",
						reason: "Waiting for new port opening program to be acquired",
					};
					rpc.send(update_msg);
					send_update = false;
				}
				await ns.sleep(10000);
			}
		}
		ns.nuke(rpc.task.target);
	}
	rpc.task.success = true;
}
