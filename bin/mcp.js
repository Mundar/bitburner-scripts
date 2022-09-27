/** @param {NS} ns */
import {IO} from "/include/io.js";
import {Servers} from "/include/mcp/servers.js";
import {setupUserHandlers, userMessageHandlers} from "/include/mcp/user.js"

export async function main(ns) {
	ns.disableLog("sleep");

	let mcp = new MCP(ns);

	await initRunScript(mcp, "home", {host:"home", action: "kill-all", useful_servers: ["home", "foodnstuff"]})
	await initRunScript(mcp, "home", {host:"home", action: "root-server", target: "foodnstuff"});
	await initRunScript(mcp, "foodnstuff", {host:"foodnstuff", action:"get-all-servers"});

	await mcp.commandLoop();
}

class MCP {
	constructor(ns) {
		this.debug_level = 3;
		this.ns = ns;
		this.io = new IO(ns, 20);
		this.servers = new Servers(ns, this);
		this.high_priority = startingHighPriorityTasks();
		this.tasks = startingTasks();
		this.waiting_tasks = initialWaitingTasks();
		this.special_tasks = [];
		this.message_handlers = setupMessageHandlers();
		this.user_handlers = setupUserHandlers();
		this.returned_data = {};
		this.next_minute = ns.getTimeSinceLastAug() + 5000;	// Run first minute tasks after 5 seconds.
		this.minute_tasks = setupMinuteTasks();
		this.next_minute_tasks = [];
		this.next_ten = 10;
		this.ten_minute_tasks = setupTenMinuteTasks();
		this.task_id = 0;
		this.running_tasks_by_id = new Map();
		this.running_tasks_by_pid = new Map();
		this.running_servers = new Map();
		this.running_services = new Map();
		this.needed_port_openers = initializeNeededPortOpeners();
		this.reserved_ram = 1024+32;		// The amount of RAM reserved on home.
		this.idle_action = "hack-exp";
		this.hack_consts = {};
	}

	async commandLoop() {
		while(true) {
			// Always check for new messages
			if(this.io.messageAvailable()) {
				const message = this.io.getMessage();
				await this.handleMessage(message);
			}
			// Next, process everything in the high priority queue
			else if(0 < this.high_priority.length) {
				const task = this.high_priority.shift();
				this.debug(2, "Performing high priority task: " + task.label);
				if(!await this.performTask(task)) {
					if(task.retries === undefined) { task.retries = 1; }
					else { task.retries += 1; 	}
					this.high_priority.push();
				}
			}
			// Process something from the regular priority queue
			else if(0 < this.tasks.length) {
				const task = this.tasks.shift();
				this.debug(2, "Performing normal priority task: " + task.label);
				if(!await this.performTask(task)) {
					if(task.retries === undefined) { task.retries = 1; }
					else { task.retries += 1; }
					this.tasks.push();
				}
			}
			// Check to see if a minute has passed
			else if(this.ns.getTimeSinceLastAug() > this.next_minute) {
				this.next_minute = this.ns.getTimeSinceLastAug() + 60000;
				for(var i = 0; i < this.minute_tasks.length; i++) {
					this.tasks.push(this.copyTask(this.minute_tasks[i]));
				}
				while(0 < this.next_minute_tasks.length) {
					const task = this.next_minute_tasks.shift();
					this.tasks.push(task);
				}
				if(1 < this.next_ten) { this.next_ten -= 1; }
				else {
					this.next_ten = 10;
					for(var i = 0; i < this.ten_minute_tasks.length; i++) {
						this.tasks.push(this.copyTask(this.ten_minute_tasks[i]));
					}
				}
			}
			else {
				await this.ns.sleep(400);
			}
			await this.ns.sleep(100);
		}
	}

	async performTask(task) {
		if(task !== undefined) {
			if (task.mcp_function !== undefined) {
				this.debug(2, "Calling MCP function: " + JSON.stringify(task));
				await task.mcp_function(this, task);
				return true;
			}
			else if(task.action !== undefined) {
				this.debug(2, "Calling RPC: " + JSON.stringify(task));
				return await this.callRPC(task);
			}
			else if(task.server !== undefined) {
				this.debug(2, "Calling Server: " + JSON.stringify(task));
				return await this.callServer(task);
			}
			else if(task.service !== undefined) {
				this.debug(2, "Calling Service: " + JSON.stringify(task));
				return await this.callService(task);
			}
			else {
				this.ns.print("Unsupported task: \"" + task.label + "\" has no associated function");
			}
		}
	}

	getTaskId() {
		this.task_id++;
		return this.task_id;
	}

	copyTask(task) {
		if(task.action === undefined) {
			return task;
		}
		else {
			const id = this.getTaskId();
			var new_task = JSON.parse(JSON.stringify(task));
			new_task.id = id;
			return new_task;
		}
	}

	createTask(label, thing) {
		if(undefined === thing) {
			if(typeof label == 'object') {
				if(undefined === label.id) {
					label.id = this.getTaskId();
					return label;
				}
			}
		}
		else if(typeof thing === 'function') {
			return {
				label: label,
				mcp_function: thing,
			}
		}
		else if(typeof thing === 'string') {
			const id = this.getTaskId();
			return {
				id: id,
				label: label,
				action: thing,
			}
		}
		else {
			return {
				label: "Invalid Task Defined: label = " + JSON.stringify(label)
					+ "; thing = " + JSON.stringify(thing) + "; typeof thing = "
					+ typeof thing,
				mcp_function: function(mcp, task) {
					mcp.ns.tprint("Invalid Task Defined: label = " + JSON.stringify(label)
						+ "; thing = " + JSON.stringify(thing) + "; typeof thing = "
						+ typeof thing);
				}
			}
		}
	}

	// The way that tasks work are as follows:
	//	For tasks that call other tasks:
	//		* Reserve memory for itself.
	//		* Reserve memory for its subtasks.
	//		* Execute script
	async callRPC(task) {
		this.debug(2, "callRPC: task = " + JSON.stringify(task));
		if(undefined === task.id) {
			task.id = this.getTaskId();
		}
		if(undefined === task.script) {
			task.script = "/rpc/" + task.action + ".js";
			task.script_exists = this.ns.fileExists(task.script, "home");
		}
		if(!task.script_exists) { return false; }
		this.debug(2, "callRPC: Script \"" + task.script + "\" exists.");
		if((undefined === task.reserved) || (0 == task.reserved.total_threads)) {
			const ram = this.ns.getScriptRam(task.script);
			if(!await this.servers.reserveMemory(ram, 1, task)) { return false; }
		}
		this.debug(2, "callRPC: Successfully reserved memory: task = " + JSON.stringify(task.reserved));
		if(task.host != "home") {
			await this.ns.scp("/include/formatting.js", task.host, "home");
			await this.ns.scp("/include/rpc.js", task.host, "home");
			await this.ns.scp("/include/server.js", task.host, "home");
			await this.ns.scp("/include/io.js", task.host, "home");
			await this.ns.scp(task.script, task.host, "home");
		}
		const pid = this.ns.exec(task.script, task.host, 1, JSON.stringify(task));
		if(0 == pid) { return false; }
		task.pid = pid;
		this.debug(2, "callRPC: Successfully executed task: task = " + JSON.stringify(task.reserved));
		this.running_tasks_by_pid.set(pid, task);
		this.running_tasks_by_id.set(task.id, task);
		return true;
	}

	async callServer(task) {
		this.debug(2, "callServer: task = " + JSON.stringify(task));
		if(this.running_servers.has(task.server)) {
			this.debug(3, "The server " + task.server + " is already running");
			if(this.ns.isRunning(this.running_servers.get(task.server).pid)) {
				while(!this.ns.tryWritePort(task.server_port, JSON.stringify(task))) { await this.ns.sleep(100); }
				return;
			}
			else {
				const non_running_task = this.running_servers.get(task.server);
				this.finishedTask(non_running_task);
			}
		}
		if(undefined === task.id) {
			task.id = this.getTaskId();
			this.debug(3, "callServer: New server task assigned ID " + task.id);
		}
		if(undefined === task.script) {
			task.script = "/rpc/servers/" + task.server + ".js";
			this.debug(3, "callServer: Server script name set to " + task.script);
			task.script_exists = this.ns.fileExists(task.script, "home");
		}
		if(!task.script_exists) { return false; }
		this.debug(2, "callServer: Script \"" + task.script + "\" exists.");
		if((undefined === task.reserved) || (0 == task.reserved.total_threads)) {
			const ram = this.ns.getScriptRam(task.script);
			if(!await this.servers.reserveMemory(ram, 1, task)) { return false; }
		}
		this.debug(2, "callServer: Successfully reserved memory: task = " + JSON.stringify(task.reserved));
		if(task.host != "home") {
			await this.ns.scp("/include/formatting.js", task.host, "home");
			await this.ns.scp("/include/rpc.js", task.host, "home");
			await this.ns.scp("/include/server.js", task.host, "home");
			await this.ns.scp("/include/io.js", task.host, "home");
			await this.ns.scp(task.script, task.host, "home");
		}
		const pid = this.ns.exec(task.script, task.host, 1, JSON.stringify(task));
		if(0 == pid) { return false; }
		task.pid = pid;
		this.debug(2, "callServer: Successfully executed task: task = " + JSON.stringify(task.reserved));
		this.running_tasks_by_pid.set(pid, task);
		this.running_tasks_by_id.set(task.id, task);
		this.running_servers.set(task.server, task);
		return true;
	}

	async callService(task) {
		this.debug(2, "callService: task = " + JSON.stringify(task));
		if(this.running_services.has(task.service)) {
			this.debug(3, "The service " + task.service + " is already running");
			if(this.ns.isRunning(this.running_services.get(task.service).pid)) {
				while(!this.ns.tryWritePort(task.service_port, JSON.stringify(task))) { await this.ns.sleep(100); }
				return;
			}
			else {
				const non_running_task = this.running_services.get(task.service);
				this.finishedTask(non_running_task);
			}
		}
		if(undefined === task.id) {
			task.id = this.getTaskId();
			this.debug(3, "callService: New service task assigned ID " + task.id);
		}
		if(undefined === task.script) {
			task.script = "/rpc/services/" + task.service + ".js";
			this.debug(3, "callService: Service script name set to " + task.script);
			task.script_exists = this.ns.fileExists(task.script, "home");
		}
		if(!task.script_exists) { return false; }
		this.debug(2, "callService: Script \"" + task.script + "\" exists.");
		if((undefined === task.reserved) || (0 == task.reserved.total_threads)) {
			const ram = this.ns.getScriptRam(task.script);
			if(!await this.servers.reserveMemory(ram, 1, task)) { return false; }
		}
		this.debug(2, "callService: Successfully reserved memory: task = " + JSON.stringify(task.reserved));
		if(task.host != "home") {
			await this.ns.scp("/include/formatting.js", task.host, "home");
			await this.ns.scp("/include/rpc.js", task.host, "home");
			await this.ns.scp("/include/server.js", task.host, "home");
			await this.ns.scp("/include/io.js", task.host, "home");
			await this.ns.scp(task.script, task.host, "home");
		}
		const pid = this.ns.exec(task.script, task.host, 1, JSON.stringify(task));
		if(0 == pid) { return false; }
		task.pid = pid;
		this.debug(2, "callService: Successfully executed task: task = " + JSON.stringify(task.reserved));
		this.running_tasks_by_pid.set(pid, task);
		this.running_tasks_by_id.set(task.id, task);
		this.running_services.set(task.service, task);
		return true;
	}

	async handleMessage(message) {
		if(this.debug_level >= 1) {
			var id = ""; var action = ""; var server = ""; var service = ""; var before = "";
			if(undefined !== message.id) { id = "ID = " + message.id; before = "; "; }
			if(undefined !== message.action) { action = before + "Action = " + message.action; before = "; "; }
			if(undefined !== message.server) { server = before + "Server = " + message.server; before = "; "; }
			if(undefined !== message.service) { server = before + "Service = " + message.service; before = "; "; }
			this.debug(1, "Received message: " + id + action + server + service);
		}
		if((message !== undefined) && ((message.action !== undefined) || (message.server !== undefined) || (message.service !== undefined))) {
			var action = "";
			if(message.action !== undefined) { action = message.action; }
			else if(message.server !== undefined) { action = message.server; }
			else if(message.service !== undefined) { action = message.service; }
			if('mcp-log' == action) {
				this.ns.print(message.task.action + ": " + message.text);
				return;
			}
			if((message.id !== undefined) && ((message.type === undefined) || ("completed" == message.type))) {
				await this.finishedTask(message);
			}
			// If there are tasks waiting on this action, put them on the tasks list.
			if(this.waiting_tasks.has(action)) {
				var tasks = this.waiting_tasks.get(action);
				this.waiting_tasks.delete(action);
				if(Array.isArray(tasks)) {
					while(0 < tasks.length) {
						const task = tasks.shift();
						this.tasks.push(task);
					}
				}
				else {
					this.tasks.push(tasks);
				}
			}
			if(this.message_handlers.has(action)) {
				const message_handler = this.message_handlers.get(action);
				if(message_handler !== undefined) {
					await message_handler(this, message);
				}
				else {
					this.ns.print("Unsupported action: " + action + " has no associated function");
				}
			}
		}
		else {
			this.ns.print("Unsupported message format: " + JSON.stringify(message));
		}
	}

	async finishedTask(task) {
		if(this.debug_level >= 1) {
			var id = ""; var action = ""; var server = ""; var service = ""; var before = "";
			if(undefined !== task.id) { id = "ID = " + task.id; before = "; "; }
			if(undefined !== task.action) { action = before + "Action = " + task.action; before = "; "; }
			if(undefined !== task.server) { server = before + "Server = " + task.server; before = "; "; }
			if(undefined !== task.service) { service = before + "Service = " + task.service; before = "; "; }
			this.debug(1, "finishingTask: " + id + action + server + service);
		}
		await this.servers.finishedTask(task);
		const task_by_id = this.running_tasks_by_id.get(task.id);
		if(undefined != task_by_id) {
			this.running_tasks_by_pid.delete(task_by_id.pid);
			this.running_tasks_by_id.delete(task.id);
		}
		if(undefined !== task.server) {
			this.running_servers.delete(task.server);
		}
		if(undefined !== task.service) {
			this.running_services.delete(task.service);
		}
	}

	async handleUserRequest(message) {
		if(message.command !== undefined) {
			const command = message.command.shift();
			const rest = message.command;
			if(this.user_handlers.has(command)) {
				const user_handler = this.user_handlers.get(command);
				if(user_handler !== undefined) {
					await user_handler(this, rest);
					return;
				}
			}
			this.ns.tprint("Unrecognized command: " + command + " " + rest);
		}
	}

	canOpenPorts() {
		// First, check to see if the number of ports has been updated.
		var can_open = 5;
		var updated = false;
		for(var crack of this.needed_port_openers.values()) {
			if(this.ns.fileExists(crack, "home")) {
				this.needed_port_openers.delete(crack);
				updated = true;
			}
			else {
				can_open -= 1;
			}
		}
		if(updated) {
			this.servers.portsUpdated(can_open);
		}
		return can_open;
	}

	async directRunRPC(task, threads) {
		if((task !== undefined) && (task.action !== undefined) && (task.host !== undefined)) {
			if(undefined === threads) { threads = 1; }
			this.debug(2, "directRunRPC: threads = " + threads + "; host = " + task.host);
			var script = "/rpc/" + task.action + ".js";
			if("home" != task.host) {
				await this.ns.scp("/include/formatting.js", task.host, "home");
				await this.ns.scp("/include/rpc.js", task.host, "home");
				await this.ns.scp("/include/server.js", task.host, "home");
				await this.ns.scp("/include/io.js", task.host, "home");
				await this.ns.scp(script, task.host, "home");
			}
			return this.ns.exec(script, task.host, threads, JSON.stringify(task));
		}
		return 0;
	}

	debug(level, string) {
		if(this.debug_level >= level) {
			this.ns.print("DEBUG: MCP: " + string);
		}
	}
}

function startingHighPriorityTasks() {
	return [];
}

function startingTasks() {
	return [];
}

function initialWaitingTasks() {
	var tasks = new Map();
	tasks.set("get-all-servers", {
		label: "Kill all tasks on startup",
		mcp_function: function(mcp, task) { add_kill_all_task(mcp); },
	});
	return tasks;
}

function setupMessageHandlers() {
	var handlers = new Map();
	handlers.set("get-all-servers", async function(mcp, task) { await update_servers(mcp, task); } );
	handlers.set("hack-constants", function(mcp, task) { define_hack_consts(mcp, task); });
	handlers.set("purchase-servers", function(mcp, task) { handle_purchase_servers(mcp, task); });
	handlers.set("root-server", function(mcp, task) { handle_root_server(mcp, task); });
	handlers.set("server-details", function(mcp, task) { update_server(mcp, task); } );
	handlers.set("user", async function(mcp, p) { await mcp.handleUserRequest(p); });
	userMessageHandlers(handlers);
	return handlers;
}

async function update_servers(mcp, result) {
	var servers = result.servers;
	servers.sort((a, b) => a.level - b.level);
	const first_time = mcp.servers.getServerData("home") === undefined;
	for(var server_data of servers[Symbol.iterator]()) {
		if(server_data.hostname !== undefined) {
			const hostname = server_data.hostname;
			mcp.servers.updateServer(hostname, server_data);
		}
	}
	if(first_time) {
		const mcp_script = mcp.ns.getScriptName();
		const mcp_host = mcp.ns.getHostname();
		const mcp_ram = mcp.ns.getScriptRam(mcp_script);
		await mcp.servers.staticMemory(mcp_ram, mcp_host);
	}
}

function update_server(mcp, task) {
	const hostname = task.target;
	const server_data = task.server;
	mcp.debug(2, "Update server: hostname = " + hostname + "; server_data = " + JSON.stringify(server_data));
	if((undefined !== hostname) && (undefined !== server_data)) {
		mcp.servers.updateServer(hostname, server_data);
	}
}

function handle_root_server(mcp, result) {
	mcp.debug(2, "Processing root_server response for " + result.target);
	mcp.servers.rootedServer(result.target);
	mcp.high_priority.push(mcp.createTask({
		label: "Update server " + result.target,
		action: "server-details",
		target: result.target,
	}))
	root_next_server(mcp);
}

function define_hack_consts(mcp, result) {
	if(result.hack_consts !== undefined) {
		mcp.debug(2, "Defining MCP hack consts to " + JSON.stringify(result.hack_consts));
		mcp.hack_consts = result.hack_consts;
	}
}

function handle_purchase_servers(mcp, result) {
	mcp.high_priority.push(mcp.createTask({
		label: "Update server list after server purchase",
		action: "get-all-servers",
	}))
}

function root_next_server(mcp) {
	var host = mcp.servers.getNextRootTarget();
	if("" == host) { return; }
	mcp.high_priority.push(mcp.createTask({
		label: "Root server " + host,
		action: "root-server",
		target: host,
	}))
}

function add_kill_all_task(mcp) {
	mcp.waiting_tasks.set("kill-all", {
		label: "Start rooting servers",
		mcp_function: function(mcp, task) {
			mcp.tasks.push(mcp.createTask("Load the hack constants", "hack-constants"));
			root_next_server(mcp);
		},
	});
	mcp.high_priority.push(mcp.createTask({
		label: "Kill all tasks",
		action: "kill-all",
		useful_servers: [].concat(mcp.servers.useful_servers),
	}));
}

function setupMinuteTasks() {
	return [
		{
			label: "Display event notifications",
			action: "notifier",
		},
		{
			label: "Run idle tasks",
			mcp_function: async function(mcp, task) {
				if((undefined !== mcp.idle_action) && ("" != mcp.idle_action)) {
					var task = {
						action: "idle/" + mcp.idle_action,
					}
					await mcp.servers.runIdleTask(task);
				}
			}
		},
	];
}

function setupTenMinuteTasks() {
	return [
		{
			label: "Check for Server Updates",
			action: "get-all-servers",
		},
	];
}

function initializeNeededPortOpeners() {
	var out = new Set();
	out.add("BruteSSH.exe");
	out.add("FTPCrack.exe");
	out.add("relaySMTP.exe");
	out.add("HTTPWorm.exe");
	out.add("SQLInject.exe");
	return out;
}

async function initRunScript(mcp, host, task, strip_message) {
	if(task.action !== undefined) {
		var script = "/rpc/" + task.action + ".js";
		if("home" != host) {
			await mcp.ns.scp("/include/formatting.js", host, "home");
			await mcp.ns.scp("/include/rpc.js", host, "home");
			await mcp.ns.scp("/include/server.js", host, "home");
			await mcp.ns.scp("/include/io.js", host, "home");
			await mcp.ns.scp(script, host, "home");
		}
		var pid = mcp.ns.exec(script, host, 1, JSON.stringify(task));
		if(0 == pid) {
			mcp.ns.tprint("Cannot run script " + script + " on " + host);
			mcp.ns.exit();
		}
		while(mcp.ns.isRunning(pid)) {
			await mcp.ns.sleep(200);
		}
	}
}
