/** @param {NS} ns */
import * as fmt from "/include/formatting.js";

export function setupUserHandlers() {
	var handlers = new Map();
	handlers.set("buy", function(mcp, rest) { buy_servers(mcp, rest); } );
	handlers.set("find", function(mcp, rest) { find_server(mcp, rest); } );
	handlers.set("help", function(mcp, rest) { help_handler(mcp, rest); } );
	handlers.set("list", function(mcp, rest) { list_servers(mcp, rest); } );
	handlers.set("status", function(mcp, rest) { display_status(mcp, rest); } );
	handlers.set("todo", function(mcp, rest) { display_todo(mcp, rest); } );
	handlers.set("update", function(mcp, rest) { manual_update(mcp, rest); } );
	return handlers;
}

function help_handler(mcp, rest) {
	const command = rest.shift();
	if(undefined === command) {
		mcp.ns.tprint("  buy         Access the purchase server interface");
		mcp.ns.tprint("  find        Find path to server");
		mcp.ns.tprint("  help        Display this help text");
		mcp.ns.tprint("  list        Display list of servers");
		mcp.ns.tprint("  status      Display status information")
		mcp.ns.tprint("  todo        Display to do list")
		mcp.ns.tprint("  update      Update internal data")
	}
	else if("buy" == command) {
		mcp.ns.tprint("USAGE: buy [size] [quantity]");
		mcp.ns.tprint("  buy 512 5       Buy 5 servers with 512 GB of RAM");
		mcp.ns.tprint("  buy 1048576 2   Buy 2 servers with 1 PB of RAM");
		mcp.ns.tprint("  buy 512TB       Show the price for servers with 512TB of RAM");
		mcp.ns.tprint("  buy             Show the prices of affordable servers");
	}
}

function list_servers(mcp, rest) {
	var options = new Set();
	for(const option of rest[Symbol.iterator]()) {
		options.add(option);
	}
	if(options.has("targets")) {
		options.add("rooted");
		options.add("hackable");
	}
	for(const [hostname, data] of mcp.servers.server_data.entries()) {
		if((options.has("rooted")) && (data.root_access == false)) { continue; }
		if((options.has("unrooted")) && (data.root_access == true)) { continue; }
		if((options.has("useless")) && (data.max_ram != 0)) { continue; }
		if((options.has("useful")) && (data.max_ram == 0)) { continue; }
		if((options.has("hackable")) && (data.max_money == 0)) { continue; }
		if((options.has("unhackable")) && (data.max_money != 0)) { continue; }
		if(options.has("purchased")) { if(!data.purchased) { continue; } }
		else { if(data.purchased) { continue; } }
		mcp.ns.tprint(fmt.align_left(hostname, 28)
			+ fmt.align_right(data.level, 5)
			+ fmt.align_right(data.ports, 2)
			+ fmt.align_right(data.max_ram, 8) + "GB  "
			+ fmt.align_right("$" + fmt.commafy(data.max_money), 20));
	}
}

function find_server(mcp, rest) {
	var target = rest.shift();
	if(target === undefined) {
		mcp.ns.tprint("Common Targets:");
		mcp.ns.tprint("  1. CSEC  2. avmnite-02h  3. I.I.I.I  4. run4theh111z  5. fulcrumassets");
		return;
	}
	else if("1" == target) { target = "CSEC"; }
	else if("2" == target) { target = "avmnite-02h"; }
	else if("3" == target) { target = "I.I.I.I"; }
	else if("4" == target) { target = "run4theh111z"; }
	else if("5" == target) { target = "fulcrumassets"; }
	const server = mcp.servers.getServerData(target);
	if(server !== undefined) {
		var backtrack = [target];
		for(var i = server.location.length; i > 0; i--) {
			const link = mcp.servers.getServerData(server.location[i-1]);
			backtrack.push(link.hostname);
			if(link.backdoor) {
				i = 1;
			}
		}
		mcp.ns.tprint("Find: " + target + ": " + backtrack.reverse().join("->"));
	}
}

function display_status(mcp, rest) {
	if(0 == rest.length) {
		mcp.ns.tprint("  mcp         Display MCP status");
		mcp.ns.tprint("  memory      Display memory status");
		mcp.ns.tprint("  servers     Display servers status");
		return;
	}
	var options = new Set();
	while(0 < rest.length) {
		options.add(rest.pop());
	}
	if(options.has("mcp")) {
		mcp.ns.tprint("MCP:");
		mcp.ns.tprint("  Running Tasks:");
		for(var [id, task] of mcp.running_tasks_by_id.entries()) {
			mcp.ns.tprint("    ID: " + id + "; task = " + JSON.stringify(task));
		}
	}
	if(options.has("servers")) {
		mcp.ns.tprint("Servers:");
		mcp.ns.tprint("  Useful servers =   " + mcp.servers.useful_servers.length);
		mcp.ns.tprint("  Useless servers =  " + mcp.servers.useless_servers.length);
		mcp.ns.tprint("  Unrooted servers = " + mcp.servers.unrooted_servers.length);
		mcp.ns.tprint("  Unported servers = " + mcp.servers.unported_servers.length);
	}
	if(options.has("memory")) {
		mcp.ns.tprint("Memory:");
		mcp.ns.tprint("  Host                 Max RAM     Free RAM     Free Idle")
		mcp.ns.tprint("  -------------------- ----------- ------------ ------------")
		for(var host of mcp.servers.useful_servers[Symbol.iterator]()) {
			const data = mcp.servers.getServerData(host);
			mcp.ns.tprint("  " + fmt.align_left(host, 20)
				+ fmt.align_right(fmt.commafy(data.max_ram, 0), 12)
				+ fmt.align_right(fmt.commafy(data.freeRam(), 2), 13)
				+ fmt.align_right(fmt.commafy(data.freeIdleRam(), 2), 13)
			);
		}
	}
}

function manual_update(mcp, rest) {
	if(0 == rest.length) {
		mcp.ns.tprint("  servers     Update servers");
		return;
	}
	var options = new Set();
	while(0 < rest.length) {
		options.add(rest.pop());
	}
	if(options.has("servers")) {
		mcp.tasks.push(mcp.createTask("Manual server update", "get-all-servers"));
	}
}

function buy_servers(mcp, rest) {
	var size = rest.shift();
	var quantity = rest.shift();
	var task = {
		action: "purchase-servers",
	};
	if(undefined !== size) {
		task.size = size;
		if(undefined !== quantity) {
			task.quantity = quantity;
			task.label = "Purchase " + quantity + " servers with " + size + " of RAM";
		}
		else {
			task.label = "Show prices for servers with " + size + " of RAM";
		}
	}
	else {
		task.label = "Show prices for purchased servers";
	}
	mcp.tasks.push(mcp.createTask(task));
}

function display_todo(mcp, rest) {
	mcp.tasks.push(mcp.createTask("Display todo list", "todo-list"));
}
