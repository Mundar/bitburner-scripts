/** @param {NS} ns */
import {IO} from "/include/mcp/io.js"

// The purpose of this is to handle everything with a server program. It handles its reserved memory and executing subtasks.
//
// It will support several different paradigms, but initially it will support tha main one.
//	1. A server that starts multiple subtasks and then waits for all of them to finish.
//	2. A server that starts subtasks and adds new tasks as old tasks complete.
//
// Here is the top level functionality for type 1.
//	* Create server object
//	* Tell it all of the subtasks to create.
//	* Give it an idle task for any extra memory.
//	* Tell server to start cycle.
//	* Return when all of the subtasks are complete.
//
// Task Object
//		action: "script-name"	// runs "/rpc/script-name.js"
//		host: "host-server"
//		target: "target-server"
//		threads: 5				// number of threads
//		delay: 1000				// number of milliseconds to wait before starting.
// Interface:
//		var map = new Subtasks(ns, task);
//		map.runTask(task);
//		map.reserveMemory(script_ram, threads, task);
export class Server {
	constructor(ns, port) {
		this.ns = ns;
		this.io = new IO(ns, port);
		this.task = JSON.parse(ns.args[0]);
		this.port = port;
		this.ports = [20];
		if(this.task.port !== undefined) {
			this.ports = [this.task.port];
		}
		if((undefined !== this.task.ports) && (Array.isArray(this.task.ports))) {
			this.ports = [].concat(this.task.ports);
		}
		this.pool = new MemoryPool(ns, this.task);
		this.task_queue = [];
		this.message_queue = [];
		this.task_count = 0;
		this.tasks_by_id = new Map();
		this.tasks_by_pid = new Map();
		this.debug = false;
	}
	addTasks(task, threads) {
		if(undefined === task.port) {
			task.port = this.port;
		}
		this.pool.reserveMemory(task, threads, this.task_queue);
	}
	async runTasks() {
		var disabled_sleep = false;
		if(this.ns.isLogEnabled("sleep")) {
			disabled_sleep = true;
			this.ns.disableLog("sleep");
		}
		this.message_queue = [];
		this.debugMsg("runTasks: task_queue = " + JSON.stringify(this.task_queue));
		while(0 < this.task_queue.length) {
			const task = this.task_queue.shift();
			await this.#runTask(task);
		}
		this.debugMsg("runTasks: task_count = " + this.task_count)
		while(0 < this.task_count) {
			if(this.io.messageAvailable()) {
				const message = this.io.getMessage();
				this.debugMsg("runTasks: Received message = " + message);
				this.message_queue.push(message);
				const task = JSON.parse(message);
				if((undefined === task.type) || ("complete" == task.type)) {
					this.debugMsg("runTasks: Finishing task = " + message);
					this.finishTask(task);
				}
				else if("log-message" == task.type) {
					this.ns.print(task.text);
				}
			}
			await this.ns.sleep(100);
		}
		if(disabled_sleep) { this.ns.enableLog("sleep"); }
	}
	async #runTask(task) {
		if("home" != task.host) {
			await this.ns.scp("/include/formatting.js", task.host, "home");
			await this.ns.scp("/include/rpc.js", task.host, "home");
			await this.ns.scp("/include/server.js", task.host, "home");
			await this.ns.scp("/include/mcp/io.js", task.host, "home");
			await this.ns.scp(task.script, task.host, "home");
		}
		const pid = this.ns.exec(task.script, task.host, task.threads, JSON.stringify(task));
		if(0 != pid) {
			task.pid = pid;
			this.tasks_by_id.set(task.id, task);
			this.tasks_by_pid.set(pid, task);
			this.task_count += 1;
		}
	}
	finishTask(task) {
		const record = this.tasks_by_id.get(task.id);
		this.tasks_by_id.delete(task.id);
		if(undefined !== record) {
			this.tasks_by_pid.delete(record.pid);
			this.task_count -= 1;
		}
	}
	hasMessage() {
		return (0 < this.message_queue.length);
	}
	getMessage() {
		return this.message_queue.pop();
	}

	async exit() {
		await this.send(this.task);
	}
	async send(message) {
		for(var port of this.ports[Symbol.iterator]()) {
			while(!await this.ns.tryWritePort(port, JSON.stringify(message))) {
				await this.ns.sleep(200);
			}
		}
	}
	async log(log_message) {
		var message = {
			type: "log-message",
			action: "mcp-log",
			text: log_message,
			task: this.task,
		};
		await this.send(message);
	}
	debugMsg(string) {
		if(this.debug) {
			this.ns.print("DEBUG: " + string);
		}
	}
}

class MemoryPool {
	constructor(ns, task) {
		this.ns = ns;
		this.hosts = new Map();
		for(var rec of task.reserved.hosts[Symbol.iterator]()) {
			if(this.hosts.has(rec.host)) {
				var bucket = this.hosts.get(rec.host);
				bucket.max_ram += rec.ram;
			}
			else {
				this.hosts.set(rec.host, new MemoryBucket(rec.ram, rec.host, this));
			}
		}
		// Permanently reserve memory used by this script.
		this.memory_uninitialized = true;
		this.tasks_by_id = new Map();
		this.tasks_by_pid = new Map();
		this.uniqueID = 0;
		this.debug = false;
	}

	getTaskId() {
		this.uniqueID += 1;
		return this.uniqueID;
	}

	reserveMemory(task, requested_threads, task_queue) {
		this.debugMsg("reserveMemory: queue length = " + task_queue.length
			+ "; requested_threads = " + requested_threads
			+ "; task = " + JSON.stringify(task));
		if(this.memory_uninitialized) {
			const script = this.ns.getScriptName();
			const script_ram = this.ns.getScriptRam(script);
			var memory = this.hosts.get(this.ns.getHostname());
			memory.reserveRam(0, script_ram);
		}
		var remaining_threads = requested_threads;
		if(undefined === task.script) {
			task.script = "/rpc/" + task.action + ".js";
		}
		if(!this.ns.fileExists(task.script, "home")) { return 0; }
		const ram = this.ns.getScriptRam(task.script, "home");
		this.debugMsg("reserveMemory: task = " + JSON.stringify(task));
		var total_threads = 0;
		for(var [host, server] of this.hosts.entries()) {
			var free_mem = server.freeRam();
			var threads = Math.floor(free_mem / ram);
			if(threads > remaining_threads) { threads = remaining_threads; }
			if(0 < threads) {
				var new_task = JSON.parse(JSON.stringify(task));
				new_task.id = this.getTaskId();
				new_task.host = host;
				new_task.threads = threads;
				const ram_used = ram * threads;
				new_task.ram_used = ram_used;
				server.reserveRam(task.id, ram_used);
				task_queue.push(new_task);
				remaining_threads -= threads;
				total_threads += threads;
			}
			if(0 == remaining_threads) { return total_threads; }
		}
		return total_threads;
	}

	finishedTask(task) {
		if(task.id !== undefined) {
			const saved_task = this.tasks_by_id(task.id);
			this.tasks_by_id.delete(task.id);
			for(var pid of saved_task.pids[Symbol.iterator]()) {
				this.tasks_by_pid.delete(pid);
			}
		}
		if(task.reserved !== undefined) {
			for(var host of task.reserved.hosts[Symbol.iterator]()) {
				this.debugMsg("Server.finishedTask: reserved = " + JSON.stringify(host));
				this.hosts.get(host.host).releaseRam(task.id);
			}
		}
	}

	debugMsg(string) {
		if(this.debug) {
			this.ns.print("DEBUG: " + string);
		}
	}
}

class MemoryBucket {
	constructor(ram, hostname, pool) {
		this.hostname = hostname;
		this.pool = pool;
		this.max_ram = ram;
		this.reserved_memory = new Map();
	}
	debugMsg(s) { this.pool.debugMsg(s); }
	freeRam() {
		this.debugMsg("freeRam: this.max_ram = " + this.max_ram);
		if(this.max_ram === undefined) { return 0; }
		var free_ram = this.max_ram;
		this.debugMsg("freeRam: free_ram = " + free_ram);
		for(const [key, ram] of this.reserved_memory.entries()) {
			var used_ram = ram;
			this.debugMsg("key = " + JSON.stringify(key) + "; used_ram = " + used_ram)
			if(used_ram === undefined) { used_ram = 0; }
			this.debugMsg("freeRam: used_ram = " + used_ram);
			free_ram -= used_ram;
			this.debugMsg("freeRam: free_ram = " + free_ram);
		}
		return free_ram;
	}
	reserveRam(key, amount) {
		this.debugMsg("reserveRam: host = " + this.hostname + "; key = " + JSON.stringify(key) + "; amount = " + amount + "; entry = " + this.reserved_memory.get(key));
		if(this.reserved_memory.has(key)) {
			const cur_amount = this.reserved_memory.get(key);
			this.reserved_memory.set(key, cur_amount + amount);
		}
		else {
			this.reserved_memory.set(key, amount);
		}
	}
	releaseRam(key) {
		this.debugMsg("releaseRam: entries = "
			+ JSON.stringify(Array.from(this.reserved_memory.entries())));
		this.debugMsg("releaseRam: host = " + this.hostname
			+ "; key = " + JSON.stringify(key)
			+ "; entry = " + this.reserved_memory.get(key));
		this.reserved_memory.delete(key);
	}
}
