/** @param {NS} ns */
import {RPC} from "/include/rpc.js";
import * as fmt from "/include/formatting.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	const locations = ns.infiltration.getPossibleLocations();
	rpc.task.infiltration_data = [];
	var infiltration_data = [];
	for(var location of locations[Symbol.iterator]()) {
		const data = ns.infiltration.getInfiltration(location.name);
		const inf_data = data.location.infiltrationData;
		const inf_record = {
			name: location.name,
			city: location.city,
			rounds: inf_data.maxClearanceLevel,
			security: inf_data.startingSecurityLevel,
			trade_rep: data.reward.tradeRep,
			sell_cash: data.reward.sellCash,
			soa_rep: data.reward.SoARep,
		};
		rpc.task.infiltration_data.push(inf_record);
		infiltration_data.push(inf_record);
	}

	infiltration_data.sort((a, b) => a.security - b.security);
	for(var rec of infiltration_data[Symbol.iterator]()) {
		ns.tprint(fmt.align_left(rec.name, 30)
			+ fmt.align_left(rec.city, 15)
			+ fmt.align_right(rec.rounds, 4)
			+ fmt.align_right(fmt.fixed(rec.security, 2), 7)
			+ fmt.align_right(fmt.decimal(rec.trade_rep, 0), 10)
			+ fmt.align_right("$" + fmt.notation(rec.sell_cash, 0), 10)
			+ fmt.align_right(fmt.decimal(rec.soa_rep, 0), 10)
		);
	}

	rpc.exit();
}