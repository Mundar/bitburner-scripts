/** @param {NS} ns */
import {RPC} from "/include/rpc.js";
import * as fmt from "/include/formatting.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	if(undefined === rpc.task.command) {
		ns.tprint("USAGE: mcp favor [command] <...>");
		ns.tprint("  Commands:");
		ns.tprint("    for [favor]                             Display the reputation needed for specified favor");
		ns.tprint("    diff [favor] [favor]                    Display the reputation needed between specified favors");
		ns.tprint("    target-favor [favor] [steps]            Display the most efficient way to get to a specific favor");
		ns.tprint("    target-reputation [reputation] [steps]  Display the most efficient way to get to a specific reputation");
	}
	else if("diff" == rpc.task.command) {
		const cur_favor = Number.parseInt(rpc.task.rest.shift());
		const next_favor = Number.parseInt(rpc.task.rest.shift());
		if((undefined === cur_favor) || (undefined === next_favor)) {
			ns.tprint("USAGE: mcp favor diff [current favor] [wanted favor]");
		}
		else {
			ns.tprint("You need " + (favor_to_reputation(next_favor) - favor_to_reputation(cur_favor) )
				+ " reputation to get from " + cur_favor + " to " + next_favor + " favor");
		}
	}
	else if("for" == rpc.task.command) {
		const favor = Number.parseInt(rpc.task.rest.shift());
		if(undefined === favor) {
			ns.tprint("USAGE: mcp favor for [favor]");
		}
		else {
			ns.tprint("You need " + favor_to_reputation(favor) + " reputation for " + favor + " favor");
		}
	}
	else if("target-favor" == rpc.task.command) {
		const favor = Number.parseInt(rpc.task.rest.shift());
		if(undefined === favor) {
			ns.tprint("USAGE: mcp favor target-favor [favor] <steps>");
		}
		else {
			var steps = Number.parseInt(rpc.task.rest.shift());
			if(undefined === steps) { steps = 1; }
			await target_favor(ns, favor, steps);
		}
	}
	else if("target-reputation" == rpc.task.command) {
		const reputation = Number.parseInt(rpc.task.rest.shift());
		if(undefined === reputation) {
			ns.tprint("USAGE: mcp favor target-reputation [reputation] <steps>");
		}
		else {
			var steps = Number.parseInt(rpc.task.rest.shift());
			if(undefined === steps) { steps = 1; }
			await target_reputation(ns, reputation, steps);
		}
	}
	else if("test" == rpc.task.command) {
		ns.tprint("Favor to Reputation 56 = " + favor_to_reputation(56));
		ns.tprint("Reputation to Favor 50779 = " + reputation_to_favor(50779));
		ns.tprint("Reputation to Favor 50780 = " + reputation_to_favor(50780));
	}

	await rpc.exit();
}

function favor_to_reputation(favor) {
	return Math.ceil((Math.pow(1.02, favor - 1) * 25500) - 25000);
}

function reputation_to_favor(reputation) {
	return 1 + Math.floor(Math.log((reputation+25000)/25500)/Math.log(1.02));
}

async function target_favor(ns, favor, steps) {
	const rep = favor_to_reputation(favor);
	await target_shared(ns, favor, rep, true, steps);
}

async function target_reputation(ns, reputation, steps) {
	const favor = reputation_to_favor(reputation);
	await target_shared(ns, favor, reputation, false, steps);
}

async function target_shared(ns, favor, rep, is_favor, steps) {
	// Setup initial values array.
	var values = [];
	const denom = (steps + 1) * 2;
	for(var i = 1; i <= steps; ++i) {
		values.push(Math.round((favor * i) / denom));
	}
	var sleep_count = 5;
	var min_values = [].concat(values);
	var min_est = target_est(rep, is_favor, min_values);
	ns.print("Initial values: est = " + min_est + "; values = [" + min_values.join(', ') + "]");
	var please_continue = true;
	while(please_continue) {
		please_continue = false;
		for(var i = 0; i < values.length; ++i) {
			var below = [].concat(values);
			below[i] -= 1;
			const below_est = target_est(rep, is_favor, below);
			if(below_est < min_est) {
				min_est = below_est;
				min_values = below;
				please_continue = true;
			}
			var above = [].concat(values);
			above[i] += 1;
			const above_est = target_est(rep, is_favor, above);
			if(above_est < min_est) {
				min_est = above_est;
				min_values = above;
				please_continue = true;
			}
		}
		values = min_values;
		ns.print("current minimum: est = " + min_est + "; values = [" + min_values.join(', ') + "]");
		sleep_count -= 1;
		if(0 >= sleep_count) {
			await ns.sleep(25);
			sleep_count = 5;
		}
	}
	var last_rep = 0;
	ns.tprint("Time estimate = " + fmt.decimal((min_est/rep)*100, 2) + "%");
	for(var this_favor of values[Symbol.iterator]()) {
		const this_rep = favor_to_reputation(this_favor);
		const add_rep = this_rep - last_rep;
		last_rep = this_rep;
		ns.tprint(
			fmt.align_right(this_favor, 5)
			+ fmt.align_right(fmt.notation(add_rep), 9)
			+ " (" + fmt.notation(this_rep) + ")"
		);
	}
	var remain = rep;
	if(is_favor) { remain -= last_rep; }
	ns.tprint(
		fmt.align_right(reputation_to_favor(remain + last_rep), 5)
		+ fmt.align_right(fmt.notation(remain), 9)
		+ " (" + fmt.notation(remain + last_rep) + ")"
	);
}

function target_est(target, is_favor, values) {
	var favor = 0;
	var est = 0;
	var last_rep = 0;
	for(var i = 0; i < values.length; ++i) {
		const rep = favor_to_reputation(values[i]);
		var time = Math.ceil((rep-last_rep)/(1+(favor/100)));
		est += time;
		last_rep = rep;
		favor = values[i];
	}
	var remain = target;
	if(is_favor) { remain -= last_rep; }
	est += Math.ceil(remain/(1+(favor/100)));
	return est;
}
