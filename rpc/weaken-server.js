/** @param {NS} ns */
import {Server} from "/include/server.js";

export async function main(ns) {
	const port = 2;
	ns.tail();
	var cp = new Server(ns, port);

	const target = cp.task.target;
	// First, determine how many threads we need.
	const sec_per_weaken = cp.task.sec_per_weaken;
	const min_sec = cp.task.min_security;
	ns.print("Minimum security for " + target + " is " + min_sec);
	var cur_sec = ns.getServerSecurityLevel(target);
	while(cur_sec > min_sec) {
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
			const resp = cp.getMessage();
			ns.print("resp = " + JSON.stringify(resp));
			total += resp.weakened;
		}
		ns.print("Weaken returned a total of " + total);

		cur_sec = ns.getServerSecurityLevel(target);
	}

	await cp.exit();
}
