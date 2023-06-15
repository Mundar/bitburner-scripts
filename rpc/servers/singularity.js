/** @param {NS} ns */
import {Server} from "/include/server.js";
import * as fmt from "/include/formatting.js";

export async function main(ns) {
	ns.tail();
	ns.disableLog("sleep");
	ns.disableLog("scp");
	ns.disableLog("exec");
	ns.disableLog("getServerSecurityLevel");
	ns.disableLog("getServerMoneyAvailable");
	var cp = new Server(ns);
	cp.debugLevel = 3;

	/*
	cp.addJobHandler("weaken", {
		setup_tasks: function(job) { return setup_weaken_tasks(job); },
		cleanup_tasks: function(job) { return cleanup_weaken_tasks(job); },
	});
	cp.addJobHandler("grow", {
		setup_tasks: function(job) { return setup_grow_tasks(job); },
		cleanup_tasks: function(job) { return cleanup_grow_tasks(job); },
	});
	cp.addJobHandler("hack", {
		setup_tasks: function(job) { return setup_hack_tasks(job); },
		cleanup_task: function(job, message) { return cleanup_hack_task(job, message); },
		cleanup_tasks: function(job) { return cleanup_hack_tasks(job); },
	});

	cp.addCommand("status", function(srv, msg) { job_status(srv, msg); });
	cp.addCommand("details", function(srv, msg) { job_details(srv, msg); });
	*/
	ns.tprint("Singularity Initialization Running...");
	cp.addTask(function(s, data) { UserActions.userActionTask(s, data); }, {});

	await cp.tasksLoop();

	await cp.exit();
}

class UserActions {
	constructor(s) {
		this.s = s;
	}
	static userActionTask(s, data) {
		var sleep_time = 60000;
		const busy = s.ns.singularity.isBusy();
		s.ns.tprint("Is busy = " + busy);
		if(busy) {
			s.ns.tprint("Current work = " + JSON.stringify(s.ns.singularity.getCurrentWork()));
		}
		s.ns.tprint("Current server = " + JSON.stringify(s.ns.singularity.getCurrentServer()));
		s.addTask(function(s, data) { UserActions.userActionTask(s, data); }, data, sleep_time);
	}
}