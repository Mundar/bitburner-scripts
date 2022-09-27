/** @param {NS} ns */
import {IO} from "/include/io.js";
import * as fmt from "/include/formatting.js";

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
		this.idle_action = "hack-exp";
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
							if((!await job.cleanup()) || (!await job.start())) {
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
								if((undefined === message.job.local) || (false == message.job.local)) {
									this.ns.print("WARNING: Job " + message.job.id + " failed to start");
								}
								this.send(job.task);
								this.jobs.delete(message.job.id);
							}
						}
						else {
							this.ns.print("ERROR: Failed to start job #" + message.job.id
								+ " because " + message.job.action + " is not supported");
							this.send(job.task);
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
		return this.message_queue.shift();
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
		this.idle_pids = [];
		this.task_queue = [];
		this.message_queue = [];
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
	async cleanup() {
		for(const pid of this.idle_pids[Symbol.iterator]()) {
			this.ns.kill(pid);
		}
		while(0 < this.idle_pids.length) {
			const pid = this.idle_pids.pop();
			while(this.ns.isRunning(pid)) { await this.ns.sleep(25); }
			if(this.tasks_by_pid.has(pid)) {
				const idle_task = this.tasks_by_pid.get(pid);
				this.finishedTask(idle_task);
			}
		}
		if(undefined !== this.handler.cleanup_tasks) {
			return await this.handler.cleanup_tasks(this);
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
	addIdleTask() {
		if((undefined === this.server.idle_action) || ("" == this.server.idle_action)) { return; }
		var task = {
			label: "Idle task",
			action: this.server.idle_action,
			idle: true,
		};
		const threads = this.pool.availableThreads(task);
		this.addTasks(task, threads);
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
			this.tasks_by_pid.set(pid, task);
			if(true == task.idle) {
				this.idle_pids.push(pid);
			}
			else {
				this.tasks_by_id.set(task.id, task);
				this.task_count += 1;
			}
		}
	}
	finishedTask(task) {
		this.debug(3, "finishedTask: task = " + JSON.stringify(task));
		const record = this.tasks_by_id.get(task.id);
		this.tasks_by_id.delete(task.id);
		if(undefined !== record) {
			if(undefined !== record.pid) {
				this.tasks_by_pid.delete(record.pid);
			}
			this.task_count -= 1;
		}
		this.pool.finishedTask(task);
	}
	availableThreads(task) {
		return this.pool.availableThreads(task);
	}
	hasMessage() {
		return (0 < this.message_queue.length);
	}
	getMessage() {
		return this.message_queue.shift();
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
		this.idle_action = "hack-exp";
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
			if((undefined === task.idle) || (false == task.idle)) {
				task.script = "/rpc/" + task.action + ".js";
			}
			else {
				task.script = "/rpc/idle/" + this.idle_action + ".js";
			}
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

	availableThreads(task) {
		this.debug(2, "availableThreads: task action = " + task.action);
		if(undefined === task.script) {
			if((undefined === task.idle) || (false == task.idle)) {
				task.script = "/rpc/" + task.action + ".js";
			}
			else {
				task.script = "/rpc/idle/" + this.idle_action + ".js";
			}
		}
		if(!this.ns.fileExists(task.script, "home")) {
			this.ns.print("ERROR: Script " + task.script + " doesn't exist on home");
			return 0;
		}
		const ram = this.ns.getScriptRam(task.script, "home");
		this.debug(3, "availableThreads: task = " + JSON.stringify(task));
		var total_threads = 0;
		for(var [host, server] of this.hosts.entries()) {
			var free_mem = server.freeRam();
			this.debug(3, "free_mem = " + free_mem);
			var threads = Math.floor((free_mem + 0.001) / ram);	// Sometimes rounding of floats is weird.
			this.debug(3, "threads = " + threads);
			total_threads += threads;
		}
		this.debug(1, "Returning " + total_threads + " from availableThreads");
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

export class Service {
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
		if(this.task.service_port === undefined) {
			this.log("ERROR: Server task doesn't have a defined port number.");
			this.exit();
			ns.exit();
		}
		this.port = this.task.service_port;
		this.io = new IO(ns, this.port);
		this.wake_time = Service.defaultWakeTime(ns.getTimeSinceLastAug());
		this.tasks = [];
		this.not_done = true;
		this.commands = new Map();
		this.commands.set("debug", function(service, message) { service.displayDebug(); });
		this.commands.set("quit", function(service, message) { service.not_done = false; });
		this.commands.set("tail", function(service, message) { service.ns.tail(); });
		if(this.task.command !== undefined) {
			this.io.sendToSelf(this.task);
		}
	}
	async start() {
		var disabled_sleep_log = false;
		if(this.ns.isLogEnabled("sleep")) {
			this.ns.disableLog("sleep");
			disabled_sleep_log = true;
		}
		while(this.not_done) {
			var sleep_length = 100;
			if(this.io.messageAvailable()) {
				var message = this.io.getMessage();
				this.debug(3, "Received message: " + JSON.stringify(message));
				if(undefined !== message.command) {
					const command = message.command;
					this.debug(1, "Command " + command + " received");
					this.debug(3, "message = " + JSON.stringify(message))
					if(this.commands.has(command)) {
						const func = this.commands.get(command);
						func(this, command);
					}
					else {
						this.ns.print("Command " + command + " not supported");
					}
				}
				else {
					this.ns.print("ERROR: Received unsuported message: " + JSON.stringify(message));
				}
			}
			else if(this.ns.getTimeSinceLastAug() >= this.wake_time) {
				const now = this.ns.getTimeSinceLastAug();
				if(now >= this.wake_time) {
					if(0 == this.tasks.length) { this.not_done = false; }
					while((0 < this.tasks.length) && (now > this.tasks.at(-1).time)) {
						const entry = this.tasks.pop();
						entry.func(this, entry.data);
					}
					if(0 < this.tasks.length) {
						this.wake_time = this.tasks.at(-1).time;
					}
					else {
						this.wake_time = Service.defaultWakeTime(now);
					}
				}
				if(sleep_length > (this.wake_time - now)) {
					sleep_length = this.wake_time - now;
				}
			}
			await this.ns.sleep(sleep_length);
		}
		if(disabled_sleep_log) { this.ns.enableLog("sleep"); }
	}
	addCommand(name, func) {
		this.commands.set(name, func);
	}
	addTask(func, data, delay) {
		var time = this.ns.getTimeSinceLastAug();
		if(undefined !== delay) { time += delay; }
		if(time < this.wake_time) { this.wake_time = time; }
		this.tasks.push({ time: time, func: func, data: data });
		this.tasks.sort((a,b) => b.time - a.time);
	}
	displayDebug() {
		const now = this.ns.getTimeSinceLastAug();
		this.ns.tprint("debug_level = " + this.debug_level);
		this.ns.tprint("now = " + now);
		this.ns.tprint("wake_time = " + this.wake_time + " (" + this.ns.tFormat(this.wake_time - now) + ")");
		this.ns.tprint("not_done = " + this.not_done);
		this.ns.tprint("commands = [" + Array.from(this.commands.keys()).join(', ') + "]");
		var times = [];
		for(const entry of this.tasks[Symbol.iterator]()) {
			times.push(entry.time - now);
		}
		this.ns.tprint("task times = [" + times.join(', ') + "]");
		this.ns.tprint("task = " + JSON.stringify(this.task));
	}
	static defaultWakeTime(now) {
		return now + (24*60*60*1000);
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
