/** @param {NS} ns */
import {RPC} from "/include/rpc.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	var sec_per_weaken = [];
	for(var cores = 1; cores <= 8; ++cores) {
		sec_per_weaken.push(ns.weakenAnalyze(1, cores));
	}

	rpc.task.hack_consts = {
		sec_per_weaken: sec_per_weaken,
		sec_per_hack: ns.hackAnalyzeSecurity(1),
		sec_per_grow: ns.growthAnalyzeSecurity(1),
	};

	await rpc.exit();
}
