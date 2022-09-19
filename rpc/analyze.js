/** @param {NS} ns */
import {RPC} from "/include/rpc.js";
import * as fmt from "/include/formatting.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	if(undefined !== rpc.task.target) {
		const host = rpc.task.host;
		const target = rpc.task.target;
		const server = ns.getServer(host);
		const cores = server.cpuCores;
		//const player = ns.getPlayer();
		rpc.task.weaken_per_thread = ns.weakenAnalyze(1, cores);
		ns.tprint("Weaken analyze 1 thread " + cores + " cores = " + rpc.task.weaken_per_thread);
		rpc.task.grow_threads_per_100 = ns.growthAnalyze(target, 2.00, cores);
		ns.tprint("Growth analyze 100% 1 cores = " + ns.growthAnalyze(target, 2.00, 1));
		ns.tprint("Growth analyze 100% " + cores + " cores = " + rpc.task.grow_threads_per_100);
		ns.tprint("Growth analyze 100% 8 cores = " + ns.growthAnalyze(target, 2.00, 8));
		ns.tprint("Growth analyze 100% 1 cores = " + ns.growthAnalyze(target, 2.00, 1));
		ns.tprint("Growth analyze 50% 1 cores = " + ns.growthAnalyze(target, 1.50, 1));
		ns.tprint("Growth analyze 10% 1 cores = " + ns.growthAnalyze(target, 1.10, 1));
		rpc.task.grow_security = ns.growthAnalyzeSecurity(1);
		ns.tprint("Growth analyze security " + cores + " cores = " + ns.growthAnalyzeSecurity(1, target, cores));
		ns.tprint("Growth analyze security cores = " + rpc.task.grow_security);
		rpc.task.hack_analyze = ns.hackAnalyze(target);
		ns.tprint("Hack money taken per thread = " + rpc.task.hack_analyze);
		rpc.task.hack_chance = ns.hackAnalyzeChance(target);
		ns.tprint("Hack chance = " + rpc.task.hack_chance);
		rpc.task.hack_security = ns.hackAnalyzeSecurity(1);
		ns.tprint("Hack security 1 thread = " + rpc.task.hack_security);
		ns.tprint("Hack security 1000 threads = " + ns.hackAnalyzeSecurity(1000));
		const target_money = ns.getServerMoneyAvailable(target);
		ns.tprint("Target money available = " + target_money);
		const target_max_money = ns.getServerMaxMoney(target);
		ns.tprint("Target maximum money available = " + target_max_money);
		const threads_calc1 = 0.50 / rpc.task.hack_analyze;
		ns.tprint("Threads calculation from hackAnalyze (50%) = " + threads_calc1);
		const threads_calc2 = ns.hackAnalyzeThreads(target, target_money*0.5);
		ns.tprint("Threads calculation from hackAnalyzeThreads (50%) = " + threads_calc2);
		var max_time = ns.getWeakenTime(target);
		const weaken_time = ns.getWeakenTime(target);
		ns.tprint("Weaken time = " + ns.tFormat(weaken_time));
		const grow_time = ns.getGrowTime(target);
		if(grow_time > max_time) { max_time = grow_time; }
		ns.tprint("Grow time = " + ns.tFormat(grow_time));
		const hack_time = ns.getHackTime(target);
		if(hack_time > max_time) { max_time = hack_time; }
		ns.tprint("Hack time = " + ns.tFormat(hack_time));
		ns.tprint("Max time = " + ns.tFormat(max_time));
		const hack_money_rate = (rpc.task.hack_chance * target_max_money * rpc.task.hack_analyze * 1000) / max_time;
		ns.tprint("Estimated money rate = $" + fmt.commafy(hack_money_rate, 3) + " per second");
	}
	else if(undefined !== rpc.task.targets) {
		rpc.task.analysis = [];
		for(var hostname of rpc.task.targets[Symbol.iterator]()) {
			var host = hostAnalyze(rpc, hostname);
			const money_per_sec_1000 = (host.max_money * host.hack_amount * host.hack_chance * host.bestimate_1000.hack_threads)
				/ (host.max_time + 4000);
			ns.tprint(
				fmt.align_left(hostname, 18)
				+ fmt.align_right(fmt.decimal(host.cur_security, 3), 3) + "/"
				+ fmt.align_right(host.min_security, 3)
				+ fmt.align_right(fmt.decimal(host.hack_chance * 100, 1), 6) + "%"
				+ fmt.align_right(fmt.decimal(host.hack_amount * 100, 6), 10) + "%"
				+ fmt.align_right(fmt.time(host.max_time), 12)
				+ fmt.align_right(fmt.notation(host.max_money), 9)
				+ fmt.align_right(host.bestimate_1000.hack_threads, 5)
				+ fmt.align_right(fmt.notation(money_per_sec_1000), 9)
			);
			rpc.task.analysis.push(host);
		}
	}

	rpc.exit();
}

function hostAnalyze(rpc, hostname) {
	const weaken_time = rpc.ns.getWeakenTime(hostname);
	var max_time = weaken_time;
	const grow_time = rpc.ns.getGrowTime(hostname);
	if(grow_time > max_time) { max_time = grow_time; }
	const hack_time = rpc.ns.getHackTime(hostname);
	if(hack_time > max_time) { max_time = hack_time; }
	var host = {
		hostname: hostname,
		min_security: rpc.ns.getServerMinSecurityLevel(hostname),
		cur_security: rpc.ns.getServerSecurityLevel(hostname),
		hack_chance: rpc.ns.hackAnalyzeChance(hostname),
		hack_amount: rpc.ns.hackAnalyze(hostname),
		weaken_time: weaken_time,
		grow_time: grow_time,
		hack_time: hack_time,
		max_time: max_time,
		max_money: rpc.ns.getServerMaxMoney(hostname),
		weaken_sec: rpc.task.hack_consts.sec_per_weaken[0],
		grow_sec: rpc.task.hack_consts.sec_per_grow,
		hack_sec: rpc.task.hack_consts.sec_per_hack,
	};
	host.bestimate_1000 = get_hgw_bestimate(rpc.ns, host, 1000);
	return host;
}

function hack_grow_weaken_estimate(ns, host, hack_percnt) {
	ns.print("Getting HGW estimates for hack percentage " + (hack_percnt*100) + "%");
	const hack_threads = Math.ceil(hack_percnt / host.hack_amount);
	const hack_weaken_threads = Math.ceil(hack_threads*host.hack_sec/host.weaken_sec);
	const hack_actual_percent = hack_threads * host.hack_amount;
	const grow_needed = 1 / (1 - hack_actual_percent);
	ns.print("Actual hack percentage/Growth percentage needed = " + (hack_actual_percent*100) + "%/" + (grow_needed*100) + "%");
	const grow_threads = Math.ceil(ns.growthAnalyze(host.hostname, grow_needed));
	const grow_weaken_threads = Math.ceil(grow_threads*host.grow_sec/host.weaken_sec);
	const weaken_threads = hack_weaken_threads + grow_weaken_threads;
	const total_threads = hack_threads + hack_weaken_threads + grow_threads + grow_weaken_threads;
	ns.print("Threads (total/hack/grow/weaken) = " + total_threads + "/" + hack_threads + "/" + grow_threads + "/" + weaken_threads);
	return {
		hack_threads: hack_threads,
		hack_weaken_threads: hack_weaken_threads,
		grow_threads: grow_threads,
		grow_weaken_threads: grow_weaken_threads,
		weaken_threads: weaken_threads,
		total_threads: total_threads,
	}
}

function get_hgw_bestimate(ns, host, threads) {
	var min = 0.0;
	var max = 0.9;
	var bestimate = {};

	for(var max_loops = 20; 0 < max_loops; --max_loops) {
		const cur = (min + max) / 2.0;
		const estimate = hack_grow_weaken_estimate(ns, host, cur);
		if(!(bestimate.hack_threads === undefined) && (bestimate.hack_threads == estimate.hack_threads)) {
			// If the number to hack threads hasn't changed between iterations, return the current estimate.
			return bestimate;
		}
		if(estimate.total_threads < threads) {
			bestimate = estimate;
			min = cur;
		}
		else if(estimate.total_threads > threads) {
			max = cur;
		}
		else {
			// Exact match
			return estimate;
		}
	}
	return bestimate;
}
