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

function needed_weaken_threads(job) {
	const target = job.task.target;
	const sec_per_weaken = job.server.task.hack_consts.sec_per_weaken[0];
	const min_sec = job.task.min_security;
	job.ns.print("Minimum security for " + target + " is " + min_sec);
	const cur_sec = job.ns.getServerSecurityLevel(target);
	if(cur_sec == min_sec) { return 0; }
	const threads = Math.ceil(((cur_sec + 0.00001) - min_sec) / sec_per_weaken);
	job.ns.print("Need " + threads + " threads in order to reduce from a security level of "
		+ cur_sec + " to " + min_sec);
	return threads;
}

function setup_weaken_tasks(job) {
	const target = job.task.target;
	// First, determine how many threads we need.
	const threads = needed_weaken_threads(job);
	if(0 == threads) { return false; }
	var weaken_task = get_weaken_task(job);
	const available_threads = job.availableThreads(weaken_task);
	job.ns.print("Available threads = " + available_threads);
	const weaken_time = job.ns.getWeakenTime(target);
	job.ns.print("Weaken time = " + job.ns.tFormat(weaken_time));

	job.addTasks(weaken_task, threads);
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
		job.ns.tprint("Finished weakening " + target);
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
	var extra_weaken_tasks = needed_weaken_threads(job);
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
	var cur_money = job.ns.getServerMoneyAvailable(target);
	if(0 == cur_money) { cur_money = 1; }
	var grow_threads = Math.ceil(job.ns.growthAnalyze(target, max_money / cur_money));
	job.ns.print("Grow threads = " + grow_threads);
	const sec_per_weaken = job.server.task.hack_consts.sec_per_weaken[0];
	const sec_per_grow = job.server.task.hack_consts.sec_per_grow;
	var weaken_threads = Math.ceil((grow_threads * sec_per_grow) / sec_per_weaken) + extra_weaken_tasks;
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
		job.ns.print("Not done growing " + target + ": $" + fmt.notation(max_money) + " > $" + fmt.notation(cur_money));
		return true;
	}
	else {
		job.ns.tprint("Finished growing " + target);
		job.ns.toast("Finished growing " + target, "success", 10000);
		return false;
	}
}

function setup_hack_tasks(job) {
	const target = job.task.target;
	// First, determine how many threads we need.
	const min_sec = job.task.min_security;
	job.ns.print("Minimum security = " + min_sec);
	const cur_sec = job.ns.getServerSecurityLevel(target);
	job.ns.print("Current security = " + cur_sec);
	const max_money = job.task.max_money;
	job.ns.print("Maximum money = $" + max_money);
	const cur_money = job.ns.getServerMoneyAvailable(target);
	job.ns.print("Current money = $" + cur_money);
	if(cur_money < max_money) {
		job.ns.print("Growing host " + target + " because it is not fully grown ($" + fmt.notation(max_money) + " > " + fmt.notation(cur_money) + ")");
		return setup_grow_tasks(job);
	}

	return run_hack_tasks(job);
}

function run_hack_tasks(job) {
	const target = job.task.target;
	const grow_weaken_time = job.ns.getWeakenTime(target);	// The grow weaken should happen last.
	job.ns.print("Grow weaken time = " + job.ns.tFormat(grow_weaken_time));
	var max_time = grow_weaken_time + 1600;
	const grow_time = job.ns.getGrowTime(target) + 800;	// Grow should finish 1 second before the grow weaken
	job.ns.print("Grow time = " + job.ns.tFormat(grow_time));
	if(grow_time > max_time) { max_time = grow_time; }
	const hack_weaken_time = grow_weaken_time + 1600;		// The hack weaken should happen 1 second before the grow.
	job.ns.print("Hack weaken time = " + job.ns.tFormat(hack_weaken_time));
	const hack_time = job.ns.getHackTime(target) + 2400;	// Hack should finish 1 second before the hack weaken
	job.ns.print("Hack time = " + job.ns.tFormat(hack_time));
	if(hack_time > max_time) { max_time = hack_time; }
	// Create the hack task. . .
	var hack_delay = max_time - hack_time;
	var hack_task = get_hack_task(job, hack_delay);
	hack_task.hack_amount = job.task.thread_data.hack_amount;
	job.ns.print("Hack task = " + JSON.stringify(hack_task));
	job.addTasks(hack_task, job.task.thread_data.hack_threads);
	// Create the weaken after hack task. . .
	var hack_weaken_delay = max_time - hack_weaken_time;
	var hack_weaken_task = get_weaken_task(job, hack_weaken_delay);
	hack_weaken_task.label += " after Hack";
	job.ns.print("Hack-weaken task = " + JSON.stringify(hack_weaken_task));
	job.addTasks(hack_weaken_task, job.task.thread_data.hack_weaken);
	// Create the grow task. . .
	var grow_delay = max_time - grow_time;
	var grow_task = get_grow_task(job, grow_delay);
	job.ns.print("Grow task = " + JSON.stringify(grow_task));
	job.addTasks(grow_task, job.task.thread_data.grow_threads);
	// Create the weaken after grow task. . .
	var grow_weaken_delay = max_time - grow_weaken_time;
	if(1 < job.task.thread_data.grow_weaken) {
		var grow_weaken_task = get_weaken_task(job, grow_weaken_delay);
		grow_weaken_task.label += " after Grow";
		job.ns.print("Grow-weaken task = " + JSON.stringify(grow_weaken_task));
		job.addTasks(grow_weaken_task, job.task.thread_data.grow_weaken - 1);
	}
	var last_grow_weaken_task = get_weaken_task(job, grow_weaken_delay + 600);
	last_grow_weaken_task.label = "Last weaken " + target + " after Grow";
	last_grow_weaken_task.add_new_hack = true;
	job.ns.print("Last grow-weaken task = " + JSON.stringify(last_grow_weaken_task));
	job.addTasks(last_grow_weaken_task, 1);
	// Optionally add a wait task
	if(job.task.thread_data.sub_total <= job.availableThreads(hack_weaken_task)) {
		var wait_task = {
			label: "Wait to add new hack tasks",
			action: "wait",
			delay: 4000,
			add_new_hack: true,
		};
		job.addTasks(wait_task, 1);
	}
	return true;
}

function cleanup_hack_task(job, message) {
	job.ns.print("Processing message for task #" + message.id + " for job #" + message.job_id + ": " + message.label);
	job.debug(3, "cleanup_hack_task: message = " + JSON.stringify(message));

	if((!job.finish) && (undefined !== message.add_new_hack) && (true == message.add_new_hack)) {
		job.ns.print("Detected add new task flag");
		const max_money = job.task.max_money;
		const cur_money = job.ns.getServerMoneyAvailable(job.task.target);
		if(cur_money < max_money) {
			job.ns.print("Reset of hack didn't recover all of the money of " + job.task.target + ": $" + fmt.notation(cur_money) + " > $" + fmt.notation(max_money));
			if(cur_money < (max_money*3/4)) {
				job.ns.print("Triggering reset of hack of " + job.task.target + ": $" + fmt.notation(cur_money) + " > $" + fmt.notation(max_money));
				job.task.reset = true;
			}
		}
		const min_sec = job.task.min_security;
		const cur_sec = job.ns.getServerSecurityLevel(job.task.target);
		if(min_sec < cur_sec) {
			job.ns.print("Reset of hack didn't restore the security level of " + job.task.target + ": " + cur_sec + " > " + min_sec);
			if((min_sec*3/2) < cur_sec) {
				job.ns.print("Triggering reset of hack of " + job.task.target + ": " + cur_sec + " > " + min_sec);
				job.task.reset = true;
			}
		}
		if(((undefined === job.task.reset) || (false == job.task.reset)) && (!job.finish)) {
			run_hack_tasks(job);
		}
	}
	return true;
}

function cleanup_hack_tasks(job) {
	const target = job.task.target;
	var index = 0;
	job.task.reset = false;
	while(job.hasMessage()) {
		job.ns.print("Message[" + index + "] = " + JSON.stringify(job.getMessage()));
		index++;
	}

	if(job.finish) {
		job.ns.tprint("Finished hacking " + target);
		job.ns.toast("Finished hacking " + target, "success", 10000);
		return false;
	}
	else {
		return true;
	}

	return !job.finish;
}

function job_status(srv, msg) {
	const param = msg.rest.shift();
	if(undefined !== param) {
		const job_id = Number.parseInt(param);
		const job = srv.jobs.get(job_id);
		if(undefined !== job) {
			srv.ns.tprint("task = " + JSON.stringify(job.task));
		}
	}
	else {
		srv.displayJobs();
	}
}

function job_details(srv, msg) {
	const param = msg.rest.shift();
	if(undefined !== param) {
		const job_id = Number.parseInt(param);
		const job = srv.jobs.get(job_id);
		if(undefined !== job) {
			srv.ns.tprint("job = " + JSON.stringify(job));
		}
	}
	else {
		srv.displayJobs();
	}
}
