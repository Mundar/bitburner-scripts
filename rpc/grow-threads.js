/** @param {NS} ns */
import {RPC} from "/include/rpc.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	const target = rpc.task.target;
	rpc.task.job_name = "Grow";
	rpc.task.job_action = "grow";
	rpc.task.min_security = ns.getServerMinSecurityLevel(target);
	rpc.task.max_money = ns.getServerMaxMoney(target);

	const cur_money = ns.getServerMoneyAvailable(target);
	const sec_per_grow = rpc.task.hack_consts.sec_per_grow;
	const sec_per_weaken = rpc.task.hack_consts.sec_per_weaken[0];
	const grow_threads = Math.ceil(ns.growthAnalyze(target,
		rpc.task.max_money / cur_money));
	const weaken_threads = Math.ceil((grow_threads * sec_per_grow)
		/ sec_per_weaken);

	rpc.task.threads = {
		weaken: weaken_threads,
		grow: grow_threads,
		total: grow_threads + weaken_threads,
	};

	await rpc.exit();
}