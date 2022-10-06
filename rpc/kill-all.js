/** @param {NS} ns */
import {RPC} from "/include/rpc.js"

export async function main(ns) {
	var rpc = new RPC(ns);

	var killing_pids = [];
	for(var host of rpc.task.useful_servers[Symbol.iterator]()) {
		var procs = ns.ps(host);
		var pause_count = 20;
		for(var proc of procs[Symbol.iterator]()) {
			if((proc.filename.endsWith('mcp.js')) || (proc.filename.endsWith('kill-all.js'))) {
				ns.print("Skipping pid " + proc.pid + ": " + proc.filename);
			}
			else {
				ns.print("Killing pid " + proc.pid + ": " + proc.filename);
				ns.kill(proc.pid);
				killing_pids.push(proc.pid);
			}
			pause_count -= 1;
			if(pause_count <= 0) {
				await ns.sleep(25);
				pause_count = 20;
			}
		}
	}
	// Now wait for all of the killed processes to die.
	while(0 < killing_pids.length) {
		const pid = killing_pids.pop();
		if(ns.isRunning(pid)) {
			killing_pids.push(pid);
			await ns.sleep(100);
		}
	}

	await rpc.exit();
}
