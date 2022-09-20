/** @param {NS} ns */
import {Server} from "/include/server.js";

export async function main(ns) {
	const port = 2;
	ns.tail();
	var cp = new Server(ns, port);

	const target = cp.task.target;
	if(!ns.hasRootAccess(target)) {
		ns.print("Can't weaken host " + target + " because you don't have root access.");
		await cp.exit();
		ns.exit();

	}
	// First, determine how many threads we need.
	const sec_per_weaken = cp.task.sec_per_weaken;
	const min_sec = cp.task.min_security;
	ns.print("Minimum security for " + target + " is " + min_sec);
	var cur_sec = ns.getServerSecurityLevel(target);
	var loop_guard = 1000;
	while((cur_sec > min_sec) && (0 < loop_guard)) {
		const threads = Math.ceil((cur_sec - min_sec) / sec_per_weaken);
		ns.print("Need " + threads + " threads in order to reduce from a security level of "
			+ cur_sec + " to " + min_sec);

		var task = {
			label: "Weaken servers",
			action: "weaken",
			target: target,
		};
		cp.addTasks(task, threads);

		await cp.runTasks();

		var total = 0;
		while(cp.hasMessage()) {
			const resp = JSON.parse(cp.getMessage());
			total += resp.weakened;
		}
		ns.print("Weaken returned a total of " + total);

		loop_guard -= 1;
		cur_sec = ns.getServerSecurityLevel(target);
	}

	await cp.exit();
}
