/** @param {NS} ns */
import {RPC} from "/include/rpc.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	const target = rpc.task.target;
	rpc.task.job_name = "Weaken";
	rpc.task.job_action = "weaken";
	rpc.task.min_security = ns.getServerMinSecurityLevel(target);

	const cur_security = ns.getServerSecurityLevel(target);
	const sec_per_weaken = rpc.task.hack_consts.sec_per_weaken[0];
	const weaken_threads = Math.ceil(((cur_security + 0.00001) - rpc.task.min_security) / sec_per_weaken);

	rpc.task.threads = {
		weaken: weaken_threads,
		total: weaken_threads,
	};

	await rpc.exit();
}
