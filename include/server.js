/** @param {NS} ns */
import {IO} from "/include/io.js";
import * as fmt from "/include/formatting.js";

// The purpose of this is to handle everything with a server program. It handles its reserved memory and executing subtasks.
//
// It will support several different paradigms, but initially it will support the main one.
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
	constructor(ns) {
		this.debug_level = 1;
		this.ns = ns;
		this.task = JSON.parse(ns.args[0]);
		this.ports = [20];
		if(this.task.port !== undefined) {
			this.ports = [this.task.port];
		}
		if((undefined !== this.task.ports) && (Array.isArray(this.task.ports))) {
			this.ports = [].concat(this.task.ports);
		}
		if(this.task.server_port === undefined) {
			this.log("ERROR: Server task doesn't have a defined port number.");
			this.exit();
			ns.exit();
		}
		this.port = this.task.server_port;
		this.io = new IO(ns, this.port);
		this.jobs = new Map();
		if(this.task.job !== undefined) {
			this.io.sendToSelf(this.task);
		}
		else {
			this.log("ERROR: Server needs at least one job assigned");
			this.exit();
			ns.exit();
		}
		this.message_queue = [];
		this.job_handlers = new Map();
	}
	async tasksLoop() {
		var disabled_sleep_log = false;
		if(this.ns.isLogEnabled("sleep")) {
			this.ns.disableLog("sleep");
			disabled_sleep_log = true;
		}
		while((0 < this.jobs.size) || (this.io.messageAvailable())) {
			if(this.io.messageAvailable()) {
				var message = this.io.getMessage();
				this.debug(3, "tasksLoop: Received message: " + JSON.stringify(message));
				if(undefined !== message.job_id) {
					this.debug(1, "tasksLoop: Received message for job " + message.job_id);
					var job = this.jobs.get(message.job_id);
					this.debug(3, "tasksLoop: job = " + JSON.stringify(job));
					if(undefined !== job) {
						job.handleMessage(message);
						if(job.done) {
							if((!job.cleanup()) || (!await job.start())) {
								this.send(job.task);
								this.jobs.delete(message.job_id);
							}
						}
					}
				}
				else {
					if(undefined !== message.job) {
						this.debug(1, "tasksLoop: Adding new job")
						this.debug(3, "tasksLoop: message = " + JSON.stringify(message))
						var job = new Job(this, message.job);
						if(this.job_handlers.has(message.job.action)) {
							this.debug(3, "tasksLoop: Adding new job with action " + message.job.action);
							job.handler = this.job_handlers.get(message.job.action);
							this.jobs.set(message.job.id, job);
							this.job_count += 1;
							if(!await job.start()) {
								this.ns.print("WARNING: Job " + message.job.id + " failed to start");
								this.send(job.task);
								this.jobs.delete(message.job.id);
							}
						}
						else {
							this.ns.print("ERROR: Failed to start job #" + message.job.id
								+ " because " + message.job.action + " is not supported");
						}
					}
					else {
						this.ns.print("ERROR: Received unsuported message: " + JSON.stringify(message));
					}
				}
			}
			await this.ns.sleep(50);
		}
		if(disabled_sleep_log) { this.ns.enableLog("sleep"); }
	}
	addJobHandler(name, handlers) {
		this.job_handlers.set(name, handlers);
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

	debug(level, string) {
		if(this.debug_level >= level) {
			this.ns.print("DEBUG: Server: " + string);
		}
	}
}

class Job {
	constructor(server, job) {
		this.debug_level = 1;
		this.ns = server.ns;
		this.server = server;
		this.task = job;
		this.handler = {};
		this.pool = new MemoryPool(this.ns, this.task);
		this.task_count = 0;
		this.tasks_by_id = new Map();
		this.tasks_by_pid = new Map();
		this.task_queue = [];
		this.message_queue = [];
		this.task_count = 0;
	}
	get done() { return (0 == this.task_count); }
	async start() {
		if(undefined !== this.handler.setup_tasks) {
			if(await this.handler.setup_tasks(this)) {
				await this.runTasks();
			}
			else {
				return false;
			}
		}
		return (0 < this.task_count);
	}
	cleanup() {
		if(undefined !== this.handler.cleanup_tasks) {
			return this.handler.cleanup_tasks(this);
		}
		return false;
	}
	handleMessage(message) {
		if((undefined === message.type) || ("completed" == message.type)) {
			this.message_queue.push(message);
			this.finishedTask(message);
			if(undefined !== this.handler.cleanup_task) {
				return this.handler.cleanup_task(this, message);
			}
			return true;
		}
	}
	addTasks(task, threads) {
		if(undefined === task.port) {
			task.port = this.server.port;
			task.job_id = this.task.id;
		}
		this.debug(3, "addTasks: Reserving memory for task " + JSON.stringify(task))
		this.pool.reserveMemory(task, threads, this.task_queue);
	}
	async runTasks() {
		this.message_queue = [];
		this.debug(2, "runTasks: task_queue = " + JSON.stringify(this.task_queue));
		while(0 < this.task_queue.length) {
			const task = this.task_queue.shift();
			await this.#runTask(task);
		}
		this.debug(2, "runTasks: task_count = " + this.task_count)
	}
	async #runTask(task) {
		if("home" != task.host) {
			await this.ns.scp("/include/formatting.js", task.host, "home");
			await this.ns.scp("/include/rpc.js", task.host, "home");
			await this.ns.scp("/include/server.js", task.host, "home");
			await this.ns.scp("/include/io.js", task.host, "home");
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
	finishedTask(task) {
		this.debug(3, "finishedTask: task = " + JSON.stringify(task));
		const record = this.tasks_by_id.get(task.id);
		this.tasks_by_id.delete(task.id);
		if(undefined !== record) {
			this.tasks_by_pid.delete(record.pid);
			this.task_count -= 1;
		}
		this.pool.finishedTask(task);
	}
	hasMessage() {
		return (0 < this.message_queue.length);
	}
	getMessage() {
		return this.message_queue.pop();
	}

	debug(level, string) {
		if(this.debug_level >= level) {
			this.ns.print("DEBUG: Job: " + string);
		}
	}
}

class MemoryPool {
	constructor(ns, task) {
		this.debug_level = 1;
		this.ns = ns;
		ns.print("Initializing MemoryPool from " + JSON.stringify(task));
		this.hosts = new Map();
		ns.print("Setting up memory from " + JSON.stringify(task.reserved));
		for(var rec of task.reserved.hosts[Symbol.iterator]()) {
			this.debug(2, "Adding " + rec.ram + "GB of RAM on server " + rec.host);
			if(this.hosts.has(rec.host)) {
				var bucket = this.hosts.get(rec.host);
				bucket.max_ram += rec.ram;
			}
			else {
				this.hosts.set(rec.host, new MemoryBucket(rec.ram, rec.host, this));
			}
		}
		// Permanently reserve memory used by this script.
		this.uniqueID = 0;
		this.debug(1, "Memory given to this server:");
		for(var [host, bucket] of this.hosts.entries()) {
			this.debug(1, "  " + fmt.align_left(host, 18)
				+ fmt.align_right(bucket.max_ram) + "GB"
			);
		}
	}

	getTaskId() {
		this.uniqueID += 1;
		this.debug(3, "getTaskId returning " + this.uniqueID);
		return this.uniqueID;
	}

	reserveMemory(task, requested_threads, task_queue) {
		this.debug(2, "reserveMemory: queue length = " + task_queue.length
			+ "; requested_threads = " + requested_threads
			+ "; task = " + JSON.stringify(task));
		var remaining_threads = requested_threads;
		if(undefined === task.script) {
			task.script = "/rpc/" + task.action + ".js";
		}
		if(!this.ns.fileExists(task.script, "home")) {
			this.ns.print("ERROR: Script " + task.script + " doesn't exist on home");
			return 0;
		}
		const ram = this.ns.getScriptRam(task.script, "home");
		this.debug(2, "reserveMemory: task = " + JSON.stringify(task));
		var total_threads = 0;
		for(var [host, server] of this.hosts.entries()) {
			var free_mem = server.freeRam();
			this.debug(3, "free_mem = " + free_mem);
			var threads = Math.floor((free_mem + 0.001) / ram);	// Sometimes rounding of floats is weird.
			this.debug(3, "threads = " + threads);
			if(threads > remaining_threads) { threads = remaining_threads; }
			this.debug(2, "Assigning " + threads + " threads to host " + host + " for a script needing " + ram + "GB of RAM")
			if(0 < threads) {
				var new_task = JSON.parse(JSON.stringify(task));
				new_task.id = this.getTaskId();
				new_task.host = host;
				new_task.threads = threads;
				const ram_used = ram * threads;
				new_task.ram_used = ram_used;
				server.reserveRam(new_task.id, ram_used);
				this.debug(3, "Queueing task " + JSON.stringify(new_task));
				task_queue.push(new_task);
				remaining_threads -= threads;
				total_threads += threads;
			}
			if(0 == remaining_threads) { break; }
		}
		this.debug(1, "Returning " + total_threads + " from reserveMemory");
		return total_threads;
	}

	finishedTask(task) {
		this.debug(1, "Performing finishedTask on task " + JSON.stringify(task));
		if(task.id !== undefined) {
			this.debug(2, "Releasing memory assigned to task #" + task.id + " from host " + task.host);
			var host = this.hosts.get(task.host);
			host.releaseRam(task.id);
		}
	}

	debug(level, string) {
		if(level <= this.debug_level) {
			this.ns.print("DEBUG: MemoryPool: " + string);
		}
	}
}

class MemoryBucket {
	constructor(ram, hostname, pool) {
		this.debug_level = 1;
		this.hostname = hostname;
		this.pool = pool;
		this.max_ram = ram;
		this.reserved_memory = new Map();
	}
	freeRam() {
		this.debug(3, "freeRam: this.max_ram = " + this.max_ram);
		if(this.max_ram === undefined) { return 0; }
		var free_ram = this.max_ram;
		this.debug(3, "freeRam: free_ram = " + free_ram);
		for(const [key, ram] of this.reserved_memory.entries()) {
			var used_ram = ram;
			this.debug(3, "key = " + JSON.stringify(key) + "; used_ram = " + used_ram)
			if(used_ram === undefined) { used_ram = 0; }
			this.debug(3, "freeRam: used_ram = " + used_ram);
			free_ram -= used_ram;
			this.debug(3, "freeRam: free_ram = " + free_ram);
		}
		this.debug(1, "freeRam returning " + free_ram);
		return free_ram;
	}
	reserveRam(key, amount) {
		this.debug(2, "reserveRam: host = " + this.hostname + "; key = " + JSON.stringify(key) + "; amount = " + amount + "; entry = " + this.reserved_memory.get(key));
		if(this.reserved_memory.has(key)) {
			const cur_amount = this.reserved_memory.get(key);
			this.reserved_memory.set(key, cur_amount + amount);
		}
		else {
			this.reserved_memory.set(key, amount);
		}
	}
	releaseRam(key) {
		this.debug(1, "releaseRam called with key " + key);
		this.debug(3, "releaseRam: entries = "
			+ JSON.stringify(Array.from(this.reserved_memory.entries())));
		this.debug(2, "releaseRam: host = " + this.hostname
			+ "; key = " + key
			+ "; entry = " + this.reserved_memory.get(key));
		this.reserved_memory.delete(key);
	}

	debug(level, string) {
		if(level <= this.debug_level) {
			this.pool.ns.print("DEBUG: MemoryBucket: " + string);
		}
	}
}
