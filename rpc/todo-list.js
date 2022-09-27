/** @param {NS} ns */
import {RPC} from "/include/rpc.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	var player = ns.getPlayer();
	var money = ns.getServerMoneyAvailable("home");
	if(!player.tor) {
		if(200000 < money) {
			ns.tprint("Purchase TOR Server to gain access to the darkweb");
		}
	}
	else {
		darkwebFile(ns, "BruteSSH.exe", 500000);
		darkwebFile(ns, "FTPCrack.exe", 1500000);
		darkwebFile(ns, "relaySMTP.exe", 5000000);
		darkwebFile(ns, "HTTPWorm.exe", 30000000);
		darkwebFile(ns, "SQLInject.exe", 250000000);
	}

	backdoorCheck(ns, "CSEC", "CyberSec");
	backdoorCheck(ns, "avmnite-02h", "NiteSec");
	backdoorCheck(ns, "I.I.I.I", "The Black Hand");
	backdoorCheck(ns, "run4theh111z", "BitRunners");

	// Manual Todo Tasks
	ns.tprint("")
	ns.tprint("Update memory allocation to use reserved space for user commands.")
	ns.tprint("Write hack server");
	ns.tprint("Write coding contract scripts");
	
	rpc.exit();
}

function backdoorCheck(ns, server_name, faction_name) {
	const server = ns.getServer(server_name);

	if(!server.backdoorInstalled) {
		if(ns.getHackingLevel() >= server.requiredHackingSkill) {
			ns.tprint("Install backdoor on server \"" + server_name + "\" in order to join " + faction_name);
		}
	}
}

function darkwebFile(ns, filename, cost) {
	var money = ns.getServerMoneyAvailable("home");
	if((!ns.fileExists(filename, "home")) && (cost < money)) {
		ns.tprint("Purchase " + filename + " from the darkweb");
	}
}
