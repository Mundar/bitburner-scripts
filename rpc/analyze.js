/** @param {NS} ns */
import {RPC} from "/include/rpc.js";
import * as fmt from "/include/formatting.js";
import * as ht from "/rpc/hack-threads.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	if(undefined !== rpc.task.target) {
		const hostname = rpc.task.host;
		const target = rpc.task.target;
		const server = ns.getServer(hostname);
		const cores = server.cpuCores;
		var host = host_analyze(rpc, target);
		const money_per_sec_1000 = (host.max_money * host.hack_amount * host.hack_chance * host.bestimate_1000.hack_threads)
			/ (host.max_time + 4000);
		ns.tprint("Host: " + host.hostname);
		ns.tprint("Max money: $" + fmt.commafy(host.max_money, 0));
		var notice = "";
		if(host.cur_security > host.min_security) { notice = " (values based on current security)"; }
		ns.tprint("Security: " + fmt.decimal(host.cur_security, 3) + "/"
			+ host.min_security + notice);
		ns.tprint("Hack chance: " + fmt.decimal(host.hack_chance * 100, 1) + "%");
		ns.tprint("Hack amount per thread: " + fmt.decimal(host.hack_amount * 100, 6) + "% ($"
			+ fmt.commafy(host.max_money * host.hack_amount, 2) + ")");
		ns.tprint("Weaken Time: " + ns.tFormat(host.weaken_time));
		ns.tprint("Grow Time:   " + ns.tFormat(host.grow_time));
		ns.tprint("Hack Time:   " + ns.tFormat(host.hack_time));
		ns.tprint("Max Concurrent: " + (Math.floor(host.max_time / 4000) - 1));
		ns.tprint("           Hack   Total.  Effic-");
		ns.tprint("  Hack %  Threads Threads iency ");
		ns.tprint("  ------- ------- ------- -------");
		var last = 0;
		var peak = { efficiency: 0 };
		var cur = 0;
		var peaks = [];

		for(var hack_threads = 1; 500 >= hack_threads; ++hack_threads) {
			const est = ht.hgw_estimate_from_threads(ns, host, hack_threads);
			cur = est.hack_threads / est.total;
			if((last < peak.efficiency) && (cur < peak.efficiency)) {
				peaks.push(JSON.parse(JSON.stringify(peak)));
			}
			last = peak.efficiency;
			peak.efficiency = cur;
			peak.estimate = est;
		}
		peaks.sort((a,b) => b.efficiency - a.efficiency);
		peaks.splice(10);
		peaks.sort((a,b) => a.estimate.hack_threads - b.estimate.hack_threads);
		for(var record of peaks[Symbol.iterator]()) {
			ns.tprint(fmt.align_right(
				fmt.fixed(host.hack_amount*record.estimate.hack_threads*100, 4), 8) + "%"
				+ fmt.align_right(record.estimate.hack_threads, 8)
				+ fmt.align_right(record.estimate.total, 8) + " "
				+ fmt.align_right(fmt.fixed(record.efficiency * 100, 3), 7) + "%"
			);
		}
		var def_record = ht.default_hack_threads(ns, host);
		ns.tprint(fmt.align_right(
			fmt.fixed(host.hack_amount*def_record.hack_threads*100, 4), 8) + "%"
			+ fmt.align_right(def_record.hack_threads, 8)
			+ fmt.align_right(def_record.total, 8) + " "
			+ fmt.align_right(fmt.fixed(def_record.hack_threads / def_record.total * 100, 3), 7) + "%"
		);
		def_record = ht.find_hack_threads(ns, host, rpc.task.max_threads); 
		ns.tprint(fmt.align_right(
			fmt.fixed(host.hack_amount*def_record.hack_threads*100, 4), 8) + "%"
			+ fmt.align_right(def_record.hack_threads, 8)
			+ fmt.align_right(def_record.total, 8) + " "
			+ fmt.align_right(fmt.fixed(def_record.hack_threads / def_record.total * 100, 3), 7) + "%"
			+ fmt.align_right(def_record.count, 5)
		);
		/*
		for(var percent = 1; percent <= 50; percent++) {
			const est = hgw_estimate_from_percent(ns, host, percent/1000);

			ns.tprint(fmt.align_right(percent, 4)
				+ fmt.align_right(est.hack_threads, 8)
				+ fmt.align_right(est.total_threads, 8) + " "
				+ fmt.align_right(est.hack_threads * 100 / est.total_threads, 7) + "%"
			);
			//if(percent > 9) { percent += 4; }
		}
		*/
	}
	else if(undefined !== rpc.task.targets) {
		rpc.task.analysis = [];
		for(var hostname of rpc.task.targets[Symbol.iterator]()) {
			var host = host_analyze(rpc, hostname);
			const money_per_sec_1000 = (host.max_money * host.hack_amount
				* host.hack_chance * host.bestimate_1000.hack_threads)
				/ (host.max_time + 4000);
			const money_max_efficiency = (host.max_money * host.hack_amount
				* host.hack_chance * host.max_efficiency.efficiency * 1000)
				/ (host.max_time + 4000);
			const hack_data = ht.find_hack_threads(ns, host, rpc.task.max_threads);
			const hack_money_est =(hack_data.hack_threads * hack_data.count
				* host.hack_chance * host.hack_amount * host.max_money)
				/ (host.max_time + 4000);
			ns.tprint(
				fmt.align_left(hostname, 18)
				+ fmt.align_right(fmt.decimal(host.cur_security, 1), 5) + "/"
				+ fmt.align_right(host.min_security, 3)
				+ fmt.align_right(fmt.decimal(host.hack_chance * 100, 1), 6) + "%"
				+ fmt.align_right(fmt.decimal(host.hack_amount * 100, 6), 10) + "%"
				+ fmt.align_right(fmt.time(host.max_time), 12)
				+ fmt.align_right(fmt.notation(host.max_money), 9)
				+ fmt.align_right(host.bestimate_1000.hack_threads, 5)
				+ fmt.align_right(fmt.notation(money_per_sec_1000), 9)
				+ fmt.align_right(Math.round(host.max_efficiency.efficiency*1000), 5)
				+ fmt.align_right(fmt.notation(money_max_efficiency), 9)
				+ fmt.align_right(hack_data.hack_threads, 5)
				+ fmt.align_right(hack_data.count, 4)
				+ fmt.align_right(hack_data.hack_threads * hack_data.count, 6)
				+ fmt.align_right(fmt.notation(hack_money_est), 9)
			);
			rpc.task.analysis.push(host);
		}
	}

	rpc.exit();
}

function host_analyze(rpc, hostname) {
	var host = ht.host_analyze(rpc, hostname);
	host.max_efficiency = get_hgw_max_efficiency(rpc.ns, host);
	host.bestimate_1000 = get_hgw_bestimate(rpc.ns, host, 1000);
	return host;
}

function hgw_estimate_from_percent(ns, host, hack_percnt) {
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
		const estimate = hgw_estimate_from_percent(ns, host, cur);
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

function get_hgw_max_efficiency(ns, host) {
	var cur = 0;
	var max = { efficiency: 0 };

	for(var hack_threads = 1; 500 >= hack_threads; ++hack_threads) {
		const est = ht.hgw_estimate_from_threads(ns, host, hack_threads);
		if(est.hack_threads != hack_threads) { break; }
		cur = est.hack_threads / est.total;
		if(cur >= max.efficiency) { max = { efficiency: cur, estimate: est }; }
	}
	return max;
}

function get_hgw_best_eff(ns, host) {
	var peaks = [];
	var last = 0;
	var peak = { efficiency: 0 } ;
	var cur = 0;
	var max = { efficiency: 0 };

	for(var hack_threads = 1; 500 >= hack_threads; ++hack_threads) {
		const est = ht.hgw_estimate_from_threads(ns, host, hack_threads);
		if(est.hack_threads != hack_threads) { break; }
		cur = est.hack_threads / est.total;
		if(cur >= max.efficiency) { max = { efficiency: cur, estimate: est }; }
		if((last < peak.efficiency) && (cur < peak.efficiency)) {
			peaks.push(JSON.parse(JSON.stringify(peak)));
		}
		last = peak.efficiency;
		peak.efficiency = cur;
		peak.estimate = est;
	}
	peaks.sort((a,b) => b.efficiency - a.efficiency);
	peaks.splice(10);
	peaks.sort((a,b) => a.estimate.hack_threads - b.estimate.hack_threads);
	return { max: max, peaks: peaks };
}
