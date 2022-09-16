/** @param {NS} ns */
import {RPC} from "/include/rpc.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	const locations = ns.infiltration.getPossibleLocations();
	rpc.task.infiltration_data = [];
	for(var location of locations[Symbol.iterator]()) {
		const data = ns.infiltration.getInfiltration(location.name);
		const inf_data = data.location.infiltrationData;
		rpc.task.infiltration_data.push({
			name: location.name,
			city: location.city,
			rounds: inf_data.maxClearanceLevel,
			security: inf_data.startingSecurityLevel,
			trade_rep: data.reward.tradeRep,
			sell_cash: data.reward.sellCash,
			soa_rep: data.reward.SoARep,
		});
	}

	rpc.exit();
}