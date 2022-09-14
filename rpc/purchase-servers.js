/** @param {NS} ns */
import {RPC} from "/include/rpc.js";
import * as fmt from "/include/formatting.js";

export async function main(ns) {
	var rpc = new RPC(ns);

	const max_servers = ns.getPurchasedServerLimit();
	if(undefined === rpc.task.size) {
		const max_ram = ns.getPurchasedServerMaxRam();
		const our_money = ns.getServerMoneyAvailable("home");
		const max_cost = ns.getPurchasedServerCost(max_ram);
		var afford = {
			ram: max_ram,
			cost: max_cost,
		};
		while((our_money < afford.cost) && (1 < afford.ram)) {
			afford.ram = Math.round(afford.ram/2);
			afford.cost = ns.getPurchasedServerCost(afford.ram);
		}
		ns.tprint("Purchased servers cost: (Money = $" + fmt.commafy(our_money, 2) + ")");
		ns.tprint("Server RAM  Cost             Max");
		ns.tprint("----------  ---------------  ---");
		var lines = 0;
		var cur_ram = afford.ram;
		var cur_cost = ns.getPurchasedServerCost(cur_ram);
		while(((0 == lines) || (1 < cur_ram)) && ((max_servers*2) > (our_money/cur_cost))) {
			var cur_max = Math.floor(our_money/cur_cost);
			if(cur_max > max_servers) {cur_max = max_servers; }
			ns.tprint(fmt.align_right(cur_ram, 10)
				+ fmt.align_right("$" + fmt.commafy(cur_cost), 17)
				+ fmt.align_right(cur_max, 5));
			if(1 < cur_ram) {
				cur_ram = Math.round(cur_ram / 2);
				cur_cost = ns.getPurchasedServerCost(cur_ram);
			}
			lines += 1;
		}
	}
	else {
		const size = fmt.textToGB(rpc.task.size);
		if(undefined === rpc.task.quantity) {
			ns.tprint("A server with " + size + " of RAM costs $"
				+ fmt.commafy(ns.getPurchasedServerCost(size)));
		}
		else {
			const server_cost = ns.getPurchasedServerCost(size);
			var remaining = rpc.task.quantity;
			var server_num = 1;
			while(ns.serverExists("maeloch-" + server_num)) { server_num += 1; }
			while((0 < remaining)
				&& (server_num <= max_servers)
				&& (ns.getServerMoneyAvailable("home") > server_cost))
			{
				const server_name = "maeloch-" + server_num;
				ns.tprint("Purchasing server " + server_name + " for $"
					+ fmt.commafy(server_cost));
				ns.purchaseServer(server_name, size);
				server_num += 1;
				remaining -= 1;
			}
		}
	}

	rpc.exit();
}