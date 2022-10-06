/** @param {NS} ns */
import {RPC} from "/include/rpc.js";
import * as fmt from "/include/formatting.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	const target = rpc.task.target;
	const host = host_analyze(rpc, target);
	rpc.task.job_name = "Hack";
	rpc.task.job_action = "hack";
	rpc.task.min_security = host.min_security;
	rpc.task.max_money = host.max_money;

	const threads = find_hack_threads(ns, host, rpc.task.max_threads);

	rpc.task.threads = {
		hack_amount: threads.hack_amount,
		hack_threads: threads.hack_threads,
		hack_weaken: threads.hack_weaken,
		grow_threads: threads.grow_threads,
		grow_weaken: threads.grow_weaken,
		weaken_threads: threads.weaken_threads,
		sub_total: threads.total,
		count: threads.count,
		total: threads.total * threads.count,
	};

	await rpc.exit();
}

function debug(ns, level, msg) {
	if(level >= 1) {
		ns.print(msg);
	}
}

export function find_hack_threads(ns, host, max_threads) {
	const max_count = Math.floor(host.max_time / 4000) - 1;
	var start_estimate = default_hack_threads(ns, host);
	debug(ns, 1, "start_estimate = " + start_estimate);
	if(start_estimate.total < max_threads) {
		start_estimate.count = Math.floor(max_threads / start_estimate.total);
		if(start_estimate.count > max_count) { start_estimate.count = max_count; }
		return start_estimate;
	}
	var threads = Math.floor(max_threads * start_estimate.hack_threads / start_estimate.total);
	debug(ns, 1, "threads = " + threads);
	var estimate = hgw_estimate_from_threads(ns, host, threads);
	while(estimate.total > max_threads) {
		threads -= 1;
		estimate = hgw_estimate_from_threads(ns, host, threads);
	}
	while(estimate.total < max_threads) {
		threads += 1;
		estimate = hgw_estimate_from_threads(ns, host, threads);
	}
	var last = 0;
	var peak = estimate.hack_threads / estimate.total;
	var peak_est = estimate;
	var cur;
	var limit = threads - 30;
	if(limit < 1) { limit = 1; }
	const start_threads = threads;
	for(; threads > limit; --threads) {
		estimate = hgw_estimate_from_threads(ns, host, threads);
		cur =  estimate.hack_threads / estimate.total;
		if((last < peak) && (cur < peak)) {
			ns.print("Found first peak after " + (threads - start_threads)
				+ " iterations at " + peak_est.hack_threads + " hack threads ("
				+ fmt.decimal(peak_est.hack_threads*host.hack_amount*100, 4) + "%); "
				+ peak_est.total + " total threads; " + peak + " efficiency");
			break;
		}
		last = peak;
		peak = cur;
		peak_est = estimate;
	}
	peak_est.count = 1;
	return peak_est;
}

export function default_hack_threads(ns, host) {
	const target_percent = host.hack_target_percent / 100;
	debug(ns, 2, "target_percent = " + target_percent);
	const start_threads = Math.ceil(target_percent / host.hack_amount) - 1;
	debug(ns, 2, "start_threads = " + start_threads);
	const max_threads = 100 + start_threads;

	var last = 0;
	var peak = 0;
	var peak_est= {};
	var cur = 0;
	var max = 0;
	var max_est = {};

	for(var hack_threads = start_threads; hack_threads < max_threads; ++hack_threads) {
		const est = hgw_estimate_from_threads(ns, host, hack_threads);
		cur = est.hack_threads / est.total;
		if(cur > max) { max = cur; max_est = est; }
		if((last < peak) && (cur < peak)) {
			ns.print("Found first peak after " + (hack_threads - start_threads)
				+ " iterations at " + peak_est.hack_threads + " hack threads ("
				+ fmt.decimal(peak_est.hack_threads*host.hack_amount*100, 4) + "%); "
				+ peak_est.total + " total threads; " + peak + " efficiency");
			return peak_est;
		}
		last = peak;
		peak = cur;
		peak_est = est;
	}
	ns.print("Using maximum after " + (max_threads - start_threads)
		+ " iterations at " + max_est.hack_threads + " hack threads ("
		+ fmt.decimal(max_est.hack_threads*host.hack_amount*100, 4) + "%); "
		+ max_est.total + " total threads; " + max + " efficiency");
	return max_est;
}

export function hgw_estimate_from_threads(ns, host, input_threads) {
	var hack_threads = input_threads;
	if(hack_threads < 0) { hack_threads = 0; }
	debug(ns, 1, "Getting HGW estimates for hack threads " + hack_threads);
	var hack_actual_percent = hack_threads * host.hack_amount;
	if(1 < hack_actual_percent) {
		hack_threads = Math.floor(1.0 / host.hack_amount);
		hack_actual_percent = hack_threads * host.hack_amount;
		debug(ns, 1, "Limiting hack threads to " + hack_threads + "\n");
	}
	const hack_weaken_threads = Math.ceil(hack_threads*host.hack_sec/host.weaken_sec);
	const grow_needed = 1 / (1 - hack_actual_percent);
	debug(ns, 1, "Actual hack percentage/Growth percentage needed = " + (hack_actual_percent*100) + "%/" + (grow_needed*100));
	const grow_threads = Math.ceil(ns.growthAnalyze(host.hostname, grow_needed));
	const grow_weaken_threads = Math.ceil(grow_threads*host.grow_sec/host.weaken_sec);
	const weaken_threads = hack_weaken_threads + grow_weaken_threads;
	const total_threads = hack_threads + hack_weaken_threads + grow_threads + grow_weaken_threads;
	debug(ns, 1, "Threads (total/hack/grow/weaken) = " + total_threads + "/" + hack_threads + "/" + grow_threads + "/" + weaken_threads);
	return {
		hack_amount: hack_actual_percent,
		hack_threads: hack_threads,
		hack_weaken: hack_weaken_threads,
		grow_threads: grow_threads,
		grow_weaken: grow_weaken_threads,
		weaken_threads: weaken_threads,
		total: total_threads,
	}
}

export function host_analyze(rpc, hostname) {
	const weaken_time = rpc.ns.getWeakenTime(hostname);
	var max_time = weaken_time;
	const grow_time = rpc.ns.getGrowTime(hostname);
	if(grow_time > max_time) { max_time = grow_time; }
	const hack_time = rpc.ns.getHackTime(hostname);
	if(hack_time > max_time) { max_time = hack_time; }
	var hack_target_percent = 10;
	if(undefined !== rpc.task.hack_target_percent) {
		hack_target_percent = rpc.task.hack_target_percent;
	}
	var hack_amount = rpc.ns.hackAnalyze(hostname);
	if(0 == hack_amount) { hack_amount = 0.0000001; }
	var host = {
		hostname: hostname,
		min_security: rpc.ns.getServerMinSecurityLevel(hostname),
		cur_security: rpc.ns.getServerSecurityLevel(hostname),
		hack_chance: rpc.ns.hackAnalyzeChance(hostname),
		hack_amount: hack_amount,
		weaken_time: weaken_time,
		grow_time: grow_time,
		hack_time: hack_time,
		max_time: max_time,
		max_money: rpc.ns.getServerMaxMoney(hostname),
		weaken_sec: rpc.task.hack_consts.sec_per_weaken[0],
		grow_sec: rpc.task.hack_consts.sec_per_grow,
		hack_sec: rpc.task.hack_consts.sec_per_hack,
		hack_target_percent: hack_target_percent,
	};
	return host;
}
