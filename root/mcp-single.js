/** @param {NS} ns */
// This is the Master Control Program for running on a single system. This is to test the 
export async function main(ns) {
	ns.disableLog("disableLog");
	ns.disableLog("enableLog");
	const target = ns.args[0];
	if(target === undefined) {
		ns.tprint("ERROR: No target specified");
		ns.tprint("USAGE: mcp-single <target>");
		ns.exit();
	}
	else if(!ns.serverExists(target)) {
		ns.tprint("Target server \"" + target + "\" doesn't exist");
		ns.exit();
	}
	const hgw = hack_grow_weaken_consts(ns, target);
	const this_server = ns.getHostname();
	if(!ns.fileExists(hgw.weaken_script)) {
		ns.tprint("Weaken script \"" + hgw.weaken_script + "\" does not exist on this server");
		ns.exit();
	}
	if(!ns.fileExists(hgw.grow_script)) {
		ns.tprint("Grow script \"" + hgw.grow_script + "\" does not exist on this server");
		ns.exit();
	}
	if(!ns.fileExists(hgw.hack_script)) {
		ns.tprint("Hack script \"" + hgw.hack_script + "\" does not exist on this server");
		ns.exit();
	}
	if(!ns.fileExists(hgw.extra_script)) {
		ns.tprint("Extra threads script \"" + hgw.extra_script + "\" does not exist on this server");
		ns.exit();
	}
	ns.tail();
	const bestimate = await get_hgw_bestimate(ns, hgw);
	ns.print("Weaken will reduce the security level by " + hgw.weak_sec + " per thread");
	// Get some constant data from the target.
	ns.print("Server maximum money is " + hgw.max_money);
	ns.print("Server minimum security is " + hgw.min_sec);
	ns.print("Maximum threads = " + hgw.max_threads);
	var cur_money = ns.getServerMoneyAvailable(target);
	while(true) {
		// Stage one is to reduce target's security level to minimum
		var cur_security = ns.getServerSecurityLevel(target);
		ns.print("Server current security is " + cur_security + "/" + hgw.min_sec);
		ns.print("Server current money available is $" + commafy(cur_money) + "/$" + commafy(hgw.max_money) + " (" + (cur_money*100/hgw.max_money)+ "%)");
		if((hgw.min_sec + 0.001) < cur_security) {
			await just_weaken(ns, hgw);
		}
		else if((hgw.max_money*0.99) > cur_money) {
			await grow_and_weaken(ns, hgw);
		}
		else {
			await hack_grow_and_weaken(ns, hgw, bestimate);
		}
		cur_money = ns.getServerMoneyAvailable(target);
	}
}

function use_extra_threads(ns, hgw, threads) {
	if(0 < threads) {
		ns.exec(hgw.extra_script, hgw.host, threads);
	}
}

function reclaim_extra_threads(ns, hgw) {
	ns.kill(hgw.extra_script, hgw.host);
}

async function just_weaken(ns, hgw) {
	var cur_security = ns.getServerSecurityLevel(hgw.target);
	const weaken_time = ns.getWeakenTime(hgw.target);
	const weaken_amount = cur_security - hgw.min_sec;
	const weaken_threads = Math.ceil(weaken_amount/hgw.weak_sec);
	ns.print("Weaken time is " + ns.tFormat(weaken_time, true));
	ns.print("We need to reduce the scurity level by " + weaken_amount);
	ns.print("We need " + weaken_threads + " threads of weaken");
	ns.print("Executing " + weaken_threads + " threads of " + hgw.weaken_script);
	ns.exec(hgw.weaken_script, hgw.host, weaken_threads, hgw.target);
	use_extra_threads(ns, hgw, hgw.max_threads - weaken_threads);
	await verbose_sleep(ns, weaken_time + 1000);
	reclaim_extra_threads(ns, hgw);
	cur_security = ns.getServerSecurityLevel(hgw.target);
	ns.print("After weakening, security level is now " + cur_security + "/" + hgw.min_sec);
}

async function grow_and_weaken(ns, hgw) {
	var cur_security = ns.getServerSecurityLevel(hgw.target);
	var cur_money = ns.getServerMoneyAvailable(hgw.target);
	const min_weaken_time = ns.getWeakenTime(hgw.target);
	const min_grow_time = ns.getGrowTime(hgw.target);
	const hack_money_per_thread = ns.hackAnalyze(hgw.target);
	ns.print("Hack money per thread = " + hack_money_per_thread);
	const hack_security_per_thread = ns.hackAnalyzeSecurity(1, hgw.target);
	ns.print("Hack security per thread = " + hack_security_per_thread);
	const grow_threads_for_double = ns.growthAnalyze(hgw.target, 2);
	ns.print("Growth money threads for 100% increase = " + grow_threads_for_double);
	const grow_security_per_thread = ns.growthAnalyzeSecurity(1);
	ns.print("Growth security per thread = " + grow_security_per_thread);
	const growth_weaken_ratio = hgw.weak_sec /	grow_security_per_thread;
	ns.print("Growth-to-weaken ratio = " + growth_weaken_ratio);
	var max_growth_grow_threads = Math.floor((hgw.max_threads * growth_weaken_ratio) / (1 + growth_weaken_ratio))
	var max_growth_weaken_threads = Math.ceil(hgw.max_threads / (1 + growth_weaken_ratio))
	if(hgw.max_threads < (max_growth_grow_threads + max_growth_weaken_threads)) {
		max_growth_grow_threads -= (max_growth_grow_threads + max_growth_weaken_threads) - hgw.max_threads;
	}
	while((max_growth_grow_threads * grow_security_per_thread) > (max_growth_weaken_threads * hgw.weak_sec)) {
		max_growth_grow_threads -= 1;
		max_growth_weaken_threads += 1;
	}
	ns.print("Max growth grow threads = " + max_growth_grow_threads);
	ns.print("Max growth weaken threads = " + max_growth_weaken_threads);
	const needed_growth = hgw.max_money / cur_money;
	ns.print("Growth percentage needed = " + (needed_growth*100) + "%");
	var needed_grow_threads;
	if(0 < cur_money) {
		needed_grow_threads = Math.ceil(ns.growthAnalyze(hgw.target, needed_growth));
	}
	else {
		needed_grow_threads = 1000000;
	}
	ns.print("Grow threads needed = " + needed_grow_threads);
	var grow_threads = max_growth_grow_threads;
	var weaken_threads = max_growth_weaken_threads;
	if(grow_threads > needed_grow_threads) {
		grow_threads = needed_grow_threads;
		weaken_threads = Math.ceil((grow_threads * grow_security_per_thread) / hgw.weak_sec);
	}
	var tasks = [];
	use_extra_threads(ns, hgw, hgw.max_threads - grow_threads - weaken_threads);
	tasks.push(timed_task((min_grow_time + 2000), grow_threads, hgw.grow_script));
	tasks.push(timed_task((min_weaken_time + 1000), weaken_threads, hgw.weaken_script));
	await process_timed_tasks(ns, hgw, tasks);
	reclaim_extra_threads(ns, hgw);
	cur_money = ns.getServerMoneyAvailable(hgw.target);
	ns.print("After growing, money available level is now " + cur_money);
	cur_security = ns.getServerSecurityLevel(hgw.target);
	ns.print("After weakening, security level is now " + cur_security + "/" + hgw.min_sec);	
}

async function hack_grow_and_weaken(ns, hgw, bestimate) {
	const min_weaken_time = ns.getWeakenTime(hgw.target);
	const min_grow_time = ns.getGrowTime(hgw.target);
	const min_hack_time = ns.getHackTime(hgw.target);
	ns.print("Minimum weaken time is " + ns.tFormat(min_weaken_time, true));
	ns.print("Minimum grow time is " + ns.tFormat(min_grow_time, true));
	ns.print("Minimum hack time is " + ns.tFormat(min_hack_time, true));
	var tasks = [];
	tasks.push(timed_task((min_hack_time + 2500), bestimate.hack_threads, hgw.hack_script));
	tasks.push(timed_task((min_grow_time - 2500), bestimate.grow_threads, hgw.grow_script));
	tasks.push(timed_task((min_weaken_time - 7500), bestimate.weaken_threads, hgw.weaken_script));
	await process_timed_tasks(ns, hgw, tasks);
	ns.print("After hack, security level is " + ns.getServerSecurityLevel(hgw.target) + "/" + hgw.min_sec);
	ns.print("After hack, available money is " + ns.getServerMoneyAvailable(hgw.target));
	await ns.sleep(5000);
	ns.print("After hack and grow, security level is " + ns.getServerSecurityLevel(hgw.target) + "/" + hgw.min_sec);
	ns.print("After hack and grow, available money is " + ns.getServerMoneyAvailable(hgw.target));
	await ns.sleep(5000);
	ns.print("After hack, grow, and weaken, security level is " + ns.getServerSecurityLevel(hgw.target) + "/" + hgw.min_sec);
	ns.print("After hack, grow, and weaken, available money is " + ns.getServerMoneyAvailable(hgw.target) + "/" + hgw.max_money);
}

async function process_timed_tasks(ns, hgw, tasks) {
	ns.print("Entering process_timed_tasks")
	tasks.sort((a, b) => a.time - b.time);
	while(0 < tasks.length) {
		const this_task = tasks.pop();
		ns.print("Executing " + this_task.threads + " threads of " + this_task.script);
		ns.exec(this_task.script, hgw.host, this_task.threads, hgw.target);
		if(0 < tasks.length) {
			const next_index = tasks.length-1;
			const next_time = tasks[next_index].time;
			await ns.sleep(this_task.time - next_time);
		}
		else {
			await verbose_sleep(ns, this_task.time);
		}
	}

}

function timed_task(time, threads, script) {
	return {
		time: parseInt(time),
		threads: threads,
		script: script,
	}
}

function hack_grow_weaken_consts(ns, target) {
	const weaken_script = "weaken.js";
	const weaken_mem = ns.getScriptRam(weaken_script);
	const host = ns.getHostname();
	var cur_mem = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
	if("home" == host) { cur_mem -= 16; } // Reserve 16GB on home for other scripts.
	const max_threads = Math.floor(cur_mem/weaken_mem);
	return {
		target: target,
		host: host,
		max_threads: max_threads,
		max_money: ns.getServerMaxMoney(target),
		min_sec: ns.getServerMinSecurityLevel(target),
		hack_pct: ns.hackAnalyze(target),
		hack_sec: ns.hackAnalyzeSecurity(1),
		grow_sec: ns.growthAnalyzeSecurity(1),
		weak_sec: ns.weakenAnalyze(1),
		hack_script: "hack.js",
		grow_script: "grow.js",
		weaken_script: weaken_script,
		extra_script: "hack-exp.js"
	};
}

function hack_grow_weaken_estimate(ns, hgw, hack_percnt) {
	ns.print("Getting HGW estimates for hack percentage " + (hack_percnt*100) + "%");
	const hack_threads = Math.ceil(hack_percnt / hgw.hack_pct);
	const hack_weaken_threads = Math.ceil(hack_threads*hgw.hack_sec/hgw.weak_sec);
	const hack_actual_percent = hack_threads * hgw.hack_pct;
	const grow_needed = 1 / (1 - hack_actual_percent);
	ns.print("Actual hack percentage/Growth percentage needed = " + (hack_actual_percent*100) + "%/" + (grow_needed*100) + "%");
	const grow_threads = Math.ceil(ns.growthAnalyze(hgw.target, grow_needed));
	const grow_weaken_threads = Math.ceil(grow_threads*hgw.grow_sec/hgw.weak_sec);
	const weaken_threads = hack_weaken_threads + grow_weaken_threads;
	const total_threads = hack_threads + hack_weaken_threads + grow_threads + grow_weaken_threads;
	ns.print("Threads (total/hack/grow/weaken) = " + total_threads + "/" + hack_threads + "/" + grow_threads + "/" + weaken_threads);
	return {
		hack_threads: hack_threads,
		grow_threads: grow_threads,
		weaken_threads: weaken_threads,
		total_threads: total_threads,
	}
}

async function get_hgw_bestimate(ns, hgw) {
	var min = 0.0;
	var max = 0.9;
	var bestimate = {};
	while(true) {
		const cur = (min + max) / 2.0;
		const estimate = hack_grow_weaken_estimate(ns, hgw, cur);
		if(!(bestimate.hack_threads === undefined) && (bestimate.hack_threads == estimate.hack_threads)) {
			// If the number to hack threads hasn't changed between iterations, return the curremt estimate.
			return estimate;
		}
		if(estimate.total_threads < hgw.max_threads) {
			bestimate = estimate;
			min = cur;
		}
		else if(estimate.total_threads > hgw.max_threads) {
			max = cur;
		}
		else {
			// Exact match
			return estimate;
		}
		await ns.sleep(100);
	}
}

async function verbose_sleep(ns, ms) {
	const remain = parseInt(ms);
	const first_wait = remain % 60000;
	var minutes = Math.floor(remain / 60000);
	ns.print("verbose_sleep: " + ns.tFormat(remain) + " left");
	ns.disableLog("sleep");
	if(0 < first_wait) {
		await ns.sleep(first_wait);
	}
	while(0 < minutes) {
		if(1 < minutes) {
			ns.print("verbose_sleep: " + minutes + " minutes left");
			minutes--;
			await ns.sleep(60000);
		}
		else {
			ns.print("verbose_sleep: 1 minute left");
			await ns.sleep(30000);
			ns.print("verbose_sleep: 30 seconds left");
			await ns.sleep(20000);
			ns.print("verbose_sleep: 10 seconds left");
			await ns.sleep(10000);
			minutes--;
		}
	}
	ns.enableLog("sleep");
}

function commafy(s) {
	var temp = Array.from(String(Math.floor(s)));
	var count = 0;
	var commafied_string = [];
	while(0 < temp.length) {
		const letter = temp.pop();
		commafied_string.push(letter);
		if((2 == count) && (0 < temp.length)) {
			commafied_string.push(',');
			count = 0;
		}
		else {
			count++;
		}
	}
	return commafied_string.reverse().join('');
}
