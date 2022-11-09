/** @param {NS} ns */
import * as fmt from "/include/formatting.js";

export function setupUserHandlers() {
	var handlers = new Map();
	handlers.set("analyze", function(mcp, rest) { analyze_server(mcp, rest); } );
	handlers.set("buy", function(mcp, rest) { buy_servers(mcp, rest); } );
	handlers.set("corp", add_service_command("Corporation service", "corporation", 18, "corp"));
	handlers.set("delete", function(mcp, rest) { delete_server(mcp, rest); } );
	handlers.set("favor", add_action_command("Favor calculations", "favor", "corp"));
	handlers.set("find", function(mcp, rest) { find_server(mcp, rest); } );
	handlers.set("grow", function(mcp, rest) { get_threads(mcp, rest, "Grow", "grow", "grow-threads"); } );
	handlers.set("hack", function(mcp, rest) { get_threads(mcp, rest, "Hack", "hack", "hack-threads"); } );
	handlers.set("hgw", add_server_command("Hack/Grow/Weaken server", "hack", 19, "hgw"));
	handlers.set("help", function(mcp, rest) { help_handler(mcp, rest); } );
	handlers.set("infiltrate", function(mcp, rest) { view_infiltrate(mcp, rest); } );
	handlers.set("list", function(mcp, rest) { list_servers(mcp, rest); } );
	handlers.set("status", function(mcp, rest) { display_status(mcp, rest); } );
	handlers.set("todo", function(mcp, rest) { display_todo(mcp, rest); } );
	handlers.set("update", function(mcp, rest) { manual_update(mcp, rest); } );
	handlers.set("weaken", function(mcp, rest) { get_threads(mcp, rest, "Weaken", "weaken", "weaken-threads"); } );
	return handlers;
}

export function userMessageHandlers(handlers) {
	handlers.set("grow-threads", async function(mcp, task) { await hack_server(mcp, task); } );
	handlers.set("hack-threads", async function(mcp, task) { await hack_server(mcp, task); } );
	handlers.set("weaken-threads", async function(mcp, task) { await hack_server(mcp, task); } );
}

function help_handler(mcp, rest) {
	const command = rest.shift();
	if(undefined === command) {
		mcp.ns.tprint("  analyze     Analyze servers for profitability");
		mcp.ns.tprint("  buy         Access the purchase server interface");
		mcp.ns.tprint("  corp        Corporation service")
		mcp.ns.tprint("  delete      Delete purchased server");
		mcp.ns.tprint("  favor       Perform favor calculations");
		mcp.ns.tprint("  find        Find path to server");
		mcp.ns.tprint("  grow        Grow server")
		mcp.ns.tprint("  hack        Hack server")
		mcp.ns.tprint("  help        Display this help text");
		mcp.ns.tprint("  list        Display list of servers");
		mcp.ns.tprint("  status      Display status information")
		mcp.ns.tprint("  todo        Display to do list")
		mcp.ns.tprint("  update      Update internal data")
		mcp.ns.tprint("  weaken      Weaken server")
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
			+ fmt.align_right("$" + fmt.commafy(data.max_money, 0), 20));
	}
}

function find_server(mcp, rest) {
	var target = rest.shift();
	if(target === undefined) {
		mcp.ns.tprint("Common Targets:");
		mcp.ns.tprint("  1. CSEC  2. avmnite-02h  3. I.I.I.I  4. run4theh111z  5. w0r1d_d43m0n");
		mcp.ns.tprint("  6. fulcrumassets  7. fulcrumtech  8. b-and-a  9. clarkeinc  10. nwo");
		return;
	}
	else if("1" == target) { target = "CSEC"; }
	else if("2" == target) { target = "avmnite-02h"; }
	else if("3" == target) { target = "I.I.I.I"; }
	else if("4" == target) { target = "run4theh111z"; }
	else if("5" == target) { target = "w0r1d_d43m0n"; }
	else if("6" == target) { target = "fulcrumassets"; }
	else if("7" == target) { target = "fulcrumtech"; }
	else if("8" == target) { target = "b-and-a"; }
	else if("9" == target) { target = "clarkeinc"; }
	else if("10" == target) { target = "nwo"; }
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
		mcp.ns.tprint("  Host                 Max RAM       Free RAM         Free Idle")
		mcp.ns.tprint("  -------------------- ------------- ---------------- ----------------")
		for(var host of mcp.servers.useful_servers[Symbol.iterator]()) {
			const data = mcp.servers.getServerData(host);
			mcp.ns.tprint("  " + fmt.align_left(host, 20)
				+ fmt.align_right(fmt.commafy(data.max_ram, 0), 14)
				+ fmt.align_right(fmt.commafy(data.freeRam(), 2), 17)
				+ fmt.align_right(fmt.commafy(data.freeIdleRam(), 2), 17)
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

function delete_server(mcp, rest) {
	var server_num = rest.shift();
	if(undefined === server_num) {
		mcp.ns.tprint("USAGE: mcp delete [number]");
		return;
	}
	const server_name = "maeloch-" + server_num;
	var task = {
		label: "Delete " + server_name,
		action: "delete-server",
		server_num: server_num,
	};
	mcp.servers.reserveTask(task, 1);
	if(mcp.servers.reserveServer(server_name)) {
		mcp.servers.removeServer(server_name);
		mcp.tasks.push(mcp.createTask(task));
	}
	else {
		mcp.ns.tprint("Unable to delete " + server_name + " because it is being used.");
		mcp.finishedTask(task);
	}
}

function display_todo(mcp, rest) {
	mcp.tasks.push(mcp.createTask("Display todo list", "todo-list"));
}

function analyze_server(mcp, rest) {
	var target = rest.shift();
	var task = {
		label: "Analyze servers",
		action: "analyze",
		hack_consts: mcp.hack_consts,
		max_threads: mcp.servers.availableThreads(mcp.ns.getScriptRam("/rpc/weaken.js", "home")),
	};
	if(undefined !== target) {
		task.target = target;
	}
	else {
		task.targets = mcp.servers.hackable_servers;
	}
	mcp.tasks.push(mcp.createTask(task));
}

function view_infiltrate(mcp, rest) {
	mcp.tasks.push(mcp.createTask("Display infiltration data", "infiltrate"));
}

function add_action_command(label, action, cmd) {
	return function(mcp, rest) { action_command(mcp, rest, label, action, cmd); }
}

function action_command(mcp, rest, label, action, cmd) {
	var command = rest.shift();
	var task = mcp.createTask({
		label: label,
		action: action,
		command: command,
		rest: rest,
	});
	mcp.debug(2, label + " task = " + JSON.stringify(task));
	mcp.tasks.push(task);
}

function add_service_command(label, service, port, cmd) {
	return function(mcp, rest) { service_command(mcp, rest, label, service, port, cmd); }
}

function service_command(mcp, rest, label, service, port, cmd) {
	var command = rest.shift();
	if(undefined === command) {
		if(undefined === cmd) {
			mcp.ns.tprint("USAGE: mcp " + service + " [command] <...>");
		}
		else {
			mcp.ns.tprint("USAGE: mcp " + cmd + " [command] <...>");
		}
		return;
	}
	var task = mcp.createTask({
		label: label,
		service: service,
		service_port: port,
		command: command,
		rest: rest,
	});
	mcp.debug(2, label + " task = " + JSON.stringify(task));
	mcp.tasks.push(task);
}

function add_server_command(label, server, port, cmd) {
	return function(mcp, rest) { server_command(mcp, rest, label, server, port, cmd); }
}

function server_command(mcp, rest, label, server, port, cmd) {
	var command = rest.shift();
	if(undefined === command) {
		if(undefined === cmd) {
			mcp.ns.tprint("USAGE: mcp " + server + " [command] <...>");
		}
		else {
			mcp.ns.tprint("USAGE: mcp " + cmd + " [command] <...>");
		}
		return;
	}
	var task = mcp.createTask({
		label: label,
		server: server,
		server_port: port,
		command: command,
		rest: rest,
	});
	mcp.debug(2, label + " task = " + JSON.stringify(task));
	mcp.tasks.push(task);
}

function get_threads(mcp, rest, proper_name, name, action) {
	var target = rest.shift();
	if(undefined === target) {
		mcp.ns.tprint("USAGE: mcp " + name + " [target]");
		return;
	}
	else if(!mcp.servers.server_data.has(target)) {
		mcp.ns.tprint("ERROR: " + target + " is not a valid hostname");
		return;
	}
	const ram = mcp.ns.getScriptRam("/rpc/weaken.js", "home");
	var task = mcp.createTask({
		label: proper_name + " " + target,
		action: action,
		target: target,
		hack_consts: mcp.hack_consts,
		max_threads: mcp.servers.availableThreads(ram),
	});
	const opt_percnt = rest.shift();
	if(undefined !== opt_percnt) {
		task.hack_target_percent = opt_percnt;
	}
	mcp.tasks.push(task);
}

async function hack_server(mcp, threads_task) {
	const threads =  threads_task.threads.total;
	if(0 == threads) { return; }
	const target = threads_task.target;
	const name = threads_task.job_name;
	const action = threads_task.job_action;
	var job = mcp.createTask({
		label: name + " " + target,
		action: action,
		target: target,
		min_security: threads_task.min_security,
		max_money: threads_task.max_money,
		thread_data: threads_task.threads,
	});
	// Weaken and grow are the same size, and hack uses 50GB less memory. I
	// use the larger value for all threads so that there aren't problems
	// fitting all of the threads reauqired if the memory allocation get
	// split among multiple hosts.
	var ram = mcp.ns.getScriptRam("/rpc/weaken.js", "home");
	mcp.debug(2, "ram = " + ram + "; threads = " + threads);
	await mcp.servers.reserveMemory(ram, threads, job);
	mcp.debug(2, name + " server job = " + JSON.stringify(job));
	var task = mcp.createTask({
		label: "Startup hack server",
		server: "hack",
		server_port: 19,
		job: job,
		hack_consts: mcp.hack_consts,
	});
	mcp.debug(2, "Hack server task = " + JSON.stringify(task));
	mcp.tasks.push(task);
}
