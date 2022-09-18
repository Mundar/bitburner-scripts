/** @param {NS} ns */
import {RPC} from "/include/rpc.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	rpc.task.min_security = ns.getServerMinSecurityLevel(rpc.task.target);
	rpc.task.cur_security = ns.getServerSecurityLevel(rpc.task.target);
	rpc.task.sec_per_weaken = ns.weakenAnalyze(1);
	rpc.task.weaken_threads = Math.ceil((rpc.task.cur_security - rpc.task.min_security) / rpc.task.sec_per_weaken);

	await rpc.exit();
}
