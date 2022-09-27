/** @param {NS} ns */
import {Server} from "/include/server.js";
import * as fmt from "/include/formatting.js";

export async function main(ns) {
	ns.tail();
	var cp = new Server(ns);

	cp.addJobHandler("weaken", {
		setup_tasks: function(job) { return setup_weaken_tasks(job); },
		cleanup_tasks: function(job) { return cleanup_weaken_tasks(job); },
	});
	cp.addJobHandler("grow", {
		setup_tasks: function(job) { return setup_grow_tasks(job); },
		cleanup_tasks: function(job) { return cleanup_grow_tasks(job); },
	});
	/*
	cp.addJobHandler("hack", {
		setup_tasks: function(job) { return setup_hack_tasks(job); },
		cleanup_tasks: function(job) { return cleanup_hack_tasks(job); },
	});
	*/

	await cp.tasksLoop();

	await cp.exit();
}

function get_task(job, name, action, delay) {
	const target = job.task.target;
	var task = {
		label: name + " " + target,
		action: action,
		target: target,
		delay: delay,
	};
	return task;
}

function get_weaken_task(job, delay) { return get_task(job, "Weaken", "weaken", delay); }
function get_grow_task(job, delay) { return get_task(job, "Grow", "grow", delay); }
function get_hack_task(job, delay) { return get_task(job, "Hack", "hack", delay); }

function add_weaken_task(job, threads, delay) { job.addTasks(get_weaken_task(job, delay), threads); }
function add_grow_task(job, threads, delay) { job.addTasks(get_grow_task(job, delay), threads); }
function add_hack_task(job, threads, delay) { job.addTasks(get_hack_task(job, delay), threads); }

function setup_weaken_tasks(job) {
	const target = job.task.target;
	// First, determine how many threads we need.
	const sec_per_weaken = job.server.task.hack_consts.sec_per_weaken[0];
	const min_sec = job.task.min_security;
	job.ns.print("Minimum security for " + target + " is " + min_sec);
	const cur_sec = job.ns.getServerSecurityLevel(target);
	const threads = Math.ceil((cur_sec - min_sec) / sec_per_weaken);
	job.ns.print("Need " + threads + " threads in order to reduce from a security level of "
		+ cur_sec + " to " + min_sec);

	add_weaken_task(job, threads);
	job.addIdleTask();
	return true;
}

function cleanup_weaken_tasks(job) {
	const target = job.task.target;
	var total = 0;
	while(job.hasMessage()) {
		const resp = job.getMessage();
		total += resp.weakened;
	}
	job.ns.print("Weaken returned a total of " + total);

	const min_sec = job.task.min_security;
	const cur_sec = job.ns.getServerSecurityLevel(target);
	if(min_sec < cur_sec) {
		job.ns.print("Not done weakening " + target + ": security " + cur_sec + " > " + min_sec);
		return true;
	}
	else {
		job.ns.toast("Finished weakening " + target, "success", 10000);
		return false;
	}
}

function setup_grow_tasks(job) {
	const target = job.task.target;
	// First, determine how many threads we need.
	const min_sec = job.task.min_security;
	job.ns.print("Minimum security = " + min_sec);
	const cur_sec = job.ns.getServerSecurityLevel(target);
	job.ns.print("Current security = " + cur_sec);
	if(min_sec < cur_sec) {
		job.ns.print("Weakening host " + target + " because it is not fully weakened (" + cur_sec + " > " + min_sec + ")");
		return setup_weaken_tasks(job);
	}

	const weaken_time = job.ns.getWeakenTime(target);
	job.ns.print("Weaken time = " + job.ns.tFormat(weaken_time));
	const grow_time = job.ns.getGrowTime(target) + 1000;	// Grow should finish 1 second before the weaken
	job.ns.print("Grow time = " + job.ns.tFormat(grow_time));
	var weaken_delay;
	var grow_delay;
	if(weaken_time > grow_time) {
		grow_delay = weaken_time - grow_time;
	}
	else {
		weaken_delay = grow_time - weaken_time;
	}
	var weaken_task = get_weaken_task(job, weaken_delay);
	job.ns.print("Weaken task = " + JSON.stringify(weaken_task));
	var grow_task = get_grow_task(job, grow_delay);
	job.ns.print("Grow task = " + JSON.stringify(grow_task));
	const max_money = job.task.max_money;
	const cur_money = job.ns.getServerMoneyAvailable(target);
	var grow_threads = Math.ceil(job.ns.growthAnalyze(target, max_money / cur_money));
	job.ns.print("Grow threads = " + grow_threads);
	const sec_per_weaken = job.server.task.hack_consts.sec_per_weaken[0];
	const sec_per_grow = job.server.task.hack_consts.sec_per_grow;
	var weaken_threads = Math.ceil((grow_threads * sec_per_grow) / sec_per_weaken);
	job.ns.print("Weaken threads = " + weaken_threads);
	const available_threads = job.availableThreads(weaken_task);
	job.ns.print("Available threads = " + available_threads);

	if(available_threads < (weaken_threads + grow_threads)) {
		job.ns.print("Not enough threads to fully grow (" + (weaken_threads + grow_threads) + " > " + available_threads + ")");
		weaken_threads = Math.ceil(available_threads / (1 + (sec_per_weaken / sec_per_grow)));
		job.ns.print("Weaken threads = " + weaken_threads);
		grow_threads = available_threads - weaken_threads;
		job.ns.print("Grow threads = " + grow_threads);
	}
	job.addTasks(grow_task, grow_threads);
	job.addTasks(weaken_task, weaken_threads);
	job.addIdleTask();
	return true;
}

function cleanup_grow_tasks(job) {
	const target = job.task.target;
	var index = 0;
	while(job.hasMessage()) {
		job.ns.print("Message[" + index + "] = " + JSON.stringify(job.getMessage()));
		index++;
	}

	const max_money = job.task.max_money;
	const cur_money = job.ns.getServerMoneyAvailable(target);
	if(cur_money < max_money) {
		job.ns.print("Not done growing " + target + ": $" + fmt.notation(max_money) + " > " + fmt.notation(cur_money));
		return true;
	}
	else {
		job.ns.print("Finished weakening " + target);
		job.ns.toast("Finished weakening " + target, "success", 10000);
		return false;
	}
}
