/** @param {NS} ns */
import {IO} from "/include/mcp/io.js";
import {Servers} from "/include/mcp/servers.js";
import {setupUserHandlers} from "/include/mcp/user.js"
import * as fmt from "/include/formatting.js"

export async function main(ns) {
	ns.disableLog("sleep");

	let mcp = new MCP(ns);

	await initRunScript(ns, "home", {host:"home", action: "root-server", target: "foodnstuff"});
	await initRunScript(ns, "foodnstuff", {host:"foodnstuff", action:"get-all-servers"});

	await mcp.commandLoop();
}

class MCP {
	constructor(ns) {
		this.ns = ns;
		this.io = new IO(ns.getPortHandle(20));
		this.servers = new Servers(ns, this);
		this.high_priority = startingHighPriorityTasks();
		this.tasks = startingTasks();
		this.waiting_tasks = initialWaitingTasks();
		this.special_tasks = [];
		this.message_handlers = setupMessageHandlers();
		this.user_handlers = setupUserHandlers();
		this.returned_data = {};
		this.next_minute = ns.getTimeSinceLastAug() + 60000;
		this.minute_tasks = setupMinuteTasks();
		this.next_minute_tasks = [];
		this.next_ten = 10;
		this.ten_minute_tasks = setupTenMinuteTasks();
		this.debug = true;
		this.task_id = 0;
		this.running_tasks_by_id = new Map();
		this.running_tasks_by_pid = new Map();
		this.running_special_tasks = new Map();
		this.needed_port_openers = initializeNeededPortOpeners();
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
				this.debugMsg("Performing high priority task: " + task.label);
				if(!await this.performTask(task)) {
					if(task.retries === undefined) { task.retries = 1; }
					else { task.retries += 1; 	}
					this.high_priority.push();
				}
			}
			// Process something from the regular priority queue
			else if(0 < this.tasks.length) {
				const task = this.tasks.shift();
				this.debugMsg("Performing normal priority task: " + task.label);
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
				this.debugMsg("Calling MCP function: " + JSON.stringify(task));
				task.mcp_function(this, task);
				return true;
			}
			else if(task.action !== undefined) {
				this.debugMsg("Calling RPC: " + JSON.stringify(task));
				return this.callRPC(task);
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
	callRPC(task) {
		this.debugMsg("callRPC: task = " + JSON.stringify(task));
		if(undefined === task.id) {
			task.id = this.getTaskId();
		}
		if(undefined === task.script) {
			task.script = "/rpc/" + task.action + ".js";
			task.script_exists = this.ns.fileExists(task.script, "home");
		}
		if(!task.script_exists) { return false; }
		this.debugMsg("callRPC: Script \"" + task.script + "\" exists.");
		if((undefined === task.reserved) || (0 == task.reserved.total_threads)) {
			const ram = this.ns.getScriptRam(task.script);
			if(!this.servers.reserveMemory(ram, 1, task)) { return false; }
		}
		this.debugMsg("callRPC: Successfully reserved memory: task = " + JSON.stringify(task.reserve));
		if(task.host != "home") {
			this.ns.scp("/include/rpc.js", task.host, "home");
			this.ns.scp(task.script, task.host, "home");
		}
		const pid = this.ns.exec(task.script, task.host, 1, JSON.stringify(task));
		if(0 == pid) { return false; }
		task.pid = pid;
		this.debugMsg("callRPC: Successfully executed task: task = " + JSON.stringify(task.reserved));
		this.running_tasks_by_pid.set(pid, task);
		this.running_tasks_by_id.set(task.id, task);
		return true;
	}

	async handleMessage(text) {
		const message = JSON.parse(text);
		if((message !== undefined) && (message.action !== undefined)) {
			const action = message.action;
			if('mcp-log' == action) {
				this.ns.print(message.task.action + ": " + message.text);
				return;
			}
			if((message.type === undefined) || ("completed" == message.type)) {
				await this.servers.finishedTask(message);
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
					message_handler(this, message);
				}
				else {
					this.ns.print("Unsupported action: " + action + " has no associated function");
				}
			}
		}
		else {
			this.ns.print("Unsupported message format: " + message);
		}
	}

	handleUserRequest(message) {
		if(message.command !== undefined) {
			const command = message.command.shift();
			const rest = message.command;
			if(this.user_handlers.has(command)) {
				const user_handler = this.user_handlers.get(command);
				if(user_handler !== undefined) {
					user_handler(this, rest);
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

	async directRunRPC(task) {
		if((task !== undefined) && (task.action !== undefined) && (task.host !== undefined)) {
			var script = "/rpc/" + task.action + ".js";
			if("home" != task.host) {
				await ns.scp("/include/rpc.js", host, "home");
				await ns.scp(script, task.host, "home");
			}
			return ns.exec(script, task.host, 1, JSON.stringify(task));
		}
	}

	debugMsg(string) {
		if(this.debug) {
			this.ns.print("DEBUG: " + string);
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
	tasks.set("kill-all", {
		label: "Start rooting servers",
		mcp_function: function(mcp, task) { root_next_server(mcp); },
	});
	return tasks;
}

function setupMessageHandlers() {
	var handlers = new Map();
	handlers.set("get-all-servers", function(mcp, task) { update_servers(mcp, task); } );
	handlers.set("root-server", function(mcp, task) { handle_root_server(mcp, task); });
	handlers.set("user", function(mcp, p) { mcp.handleUserRequest(p); });
	return handlers;
}

function update_servers(mcp, result) {
	mcp.debugMsg("Processing update_servers. . .");
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
		mcp.servers.staticMemory(mcp_ram, mcp_host);
	}
}

function handle_root_server(mcp, result) {
	mcp.debugMsg("Processing root_server response for " + result.target);
	mcp.servers.rootedServer(result.target);
	root_next_server(mcp);
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
	mcp.high_priority.push(mcp.createTask({
		label: "Kill all tasks",
		action: "kill-all",
		useful_servers: [].concat(mcp.servers.useful_servers),
	}));
}

function setupMinuteTasks() {
	return [];
	return [
		{
			label: "Test Minute Task",
			mcp_function: function(mcp, task) {
				mcp.ns.print("This is the test minute task.");
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

async function initRunScript(ns, host, task) {
	if(task.action !== undefined) {
		var script = "/rpc/" + task.action + ".js";
		if("home" != host) {
			await ns.scp("/include/rpc.js", host, "home");
			await ns.scp(script, host, "home");
		}
		var pid = ns.exec(script, host, 1, JSON.stringify(task));
		if(0 == pid) {
			ns.tprint("Cannot run script " + script + " on " + host);
			ns.exit();
		}
		while(ns.isRunning(pid)) {
			await ns.sleep(200);
		}
	}
}
