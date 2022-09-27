/** @param {NS} ns */
import {RPC} from "/include/rpc.js";

export async function main(ns) {
	var rpc = new RPC(ns);
	await rpc.delay();

	rpc.task.grown = await ns.grow(rpc.task.target);

	await rpc.exit();
}