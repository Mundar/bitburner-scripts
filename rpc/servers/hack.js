/** @param {NS} ns */
import {Server} from "/include/server.js";

export async function main(ns) {
	ns.tail();
	var cp = new Server(ns);

	cp.addJobHandler("weaken", {
		setup_tasks: function(job) { return setup_weaken_tasks(job); },
		cleanup_tasks: function(job) { return cleanup_weaken_tasks(job); },
	});

	await cp.tasksLoop();

	await cp.exit();
}

function setup_weaken_tasks(job) {
	const target = job.task.target;
	// First, determine how many threads we need.
	const sec_per_weaken = job.task.sec_per_weaken;
	const min_sec = job.task.min_security;
	job.ns.print("Minimum security for " + target + " is " + min_sec);
	var cur_sec = job.ns.getServerSecurityLevel(target);
	const threads = Math.ceil((cur_sec - min_sec) / sec_per_weaken);
	job.ns.print("Need " + threads + " threads in order to reduce from a security level of "
		+ cur_sec + " to " + min_sec);

	var task = {
		label: "Weaken servers",
		action: "weaken",
		target: target,
	};
	job.addTasks(task, threads);
	return true;
}

function cleanup_weaken_tasks(job) {
	var total = 0;
	while(job.hasMessage()) {
		const resp = job.getMessage();
		total += resp.weakened;
	}
	job.ns.print("Weaken returned a total of " + total);

	const min_sec = job.server.task.min_security;
	const cur_sec = job.ns.getServerSecurityLevel(job.task.target);
	if(min_sec < cur_sec) {
		return true;
	}
	else {
		job.ns.toast("Finished weakening " + job.task.target, "success", 10000);
		return false;
	}
}
