/** @param {NS} ns */
import {Task} from "/include/task.js";

export class Servers {
	constructor(ns, mcp) {
		this.debug_level = 1;
		this.ns = ns;
		this.mcp = mcp;
		this.server_data = new Map();
		this.useful_servers = [];
		this.useless_servers = [];
		this.hackable_servers = [];
		this.purchased_servers = [];
		this.rooted_servers = [];
		this.rooting_server = [];
		this.unrooted_servers = [];
		this.unported_servers = [];
		this.reserved = {
			host: '',
			ram: 0,
		};
	}

	async staticMemory(ram, host) {
		var server = this.getServerData(host);
		await server.reserveRam(0, ram);
	}

	async reserveMemory(ram, requested_threads, task) {
		this.debug(2, "reserveMemory: ram = " + ram
			+ "; requested_threads = " + requested_threads
			+ "; task = " + JSON.stringify(task));
		var remaining_threads = requested_threads;
		if(undefined === task.reserved) {
			task.reserved = {
				total_ram: 0,
				total_threads: 0,
				hosts: [],
			}
		}
		this.debug(2, "reserveMemory: task = " + JSON.stringify(task));
		for(var host of this.useful_servers[Symbol.iterator]()) {
			var server = this.getServerData(host);
			var free_mem = server.freeRam();
			if(("home" == host) && (1 != requested_threads)) {
				if(free_mem > this.mcp.reserved_ram) {
					free_mem -= this.mcp.reserved_ram;
				}
				else {
					free_mem = 0;
				}
			}
			var threads = Math.floor(free_mem / ram);
			if(threads > remaining_threads) { threads = remaining_threads; }
			if(0 < threads) {
				if(undefined === task.host)	{ task.host = host; }
				const ram_used = ram * threads;
				await server.reserveRam(task.id, ram_used);
				task.reserved.total_ram += ram_used;
				task.reserved.total_threads += threads;
				task.reserved.hosts.push({ host: host, ram: ram_used, threads: threads });
				remaining_threads -= threads;
			}
			if(0 == remaining_threads) { return true; }
		}
		return false;
	}

	async reserveTask(task, requested_threads) {
		this.debug(3, "reserveTask: ram = " + ram);
		var my_task = new Task(this.ns, task);
		const script = my_task.script;
		if(undefined === script) { return false; }
		this.debug(1, "my_task.data = " + JSON.stringify(my_task.data));
		this.debug(1, "task = " + JSON.stringify(task));
		const ram = ns.getScriptRam(script, "home");
		return this.reserveMemory(ram, requested_threads, task);
	}

	availableThreads(ram) {
		this.debug(1, "availableThreads: ram = " + ram);
		var threads = 0;
		for(var host of this.useful_servers[Symbol.iterator]()) {
			var server = this.getServerData(host);
			var free_mem = server.freeRam();
			if("home" == host) {
				if(free_mem > this.mcp.reserved_ram) {
					free_mem -= this.mcp.reserved_ram;
				}
				else {
					free_mem = 0;
				}
			}
			threads += Math.floor(free_mem / ram);
		}
		this.debug(1, "availbleThreads returning " + threads + " threads");
		return threads;
	}

	async reserveServer(server_name, task) {
		this.debug(2, "reserveServer: server_name = " + server_name
			+ "; task = " + JSON.stringify(task));
		if(undefined === task.reserved) {
			task.reserved = {
				total_ram: 0,
				total_threads: 0,
				hosts: [],
			}
		}
		this.debug(3, "reserveMemory: task = " + JSON.stringify(task));
		if("home" == server_name) { return false; }
		var server = this.getServerData(server_name);
		const req_ram = server.max_ram;
		const free_mem = server.freeRam();
		if(free_mem < req_ram) { return false; }
		await server.reserveRam(task.id, req_ram);
		task.reserved.total_ram += req_ram;
		task.reserved.hosts.push({ host: server_name, ram: req_ram, threads: 0 });
		return true;
	}

	updateServer(hostname, details) {
		if(this.server_data.has(hostname)) {
			let server = this.server_data.get(hostname);
			server.update(details)
		}
		else {
			let server = new ServerData(this, hostname, details);
			this.server_data.set(hostname, server);
			if(server.root_access) {
				if(0 < server.max_ram) {
					this.useful_servers.push(hostname);
				}
				else {
					this.useless_servers.push(hostname);
				}
				if(0 < server.max_money) {
					this.hackable_servers.push(hostname);
				}
			}
			else if((1 < server.level) || (0 == server.ports)) {
				const unrooted_info = {
					hostname: hostname,
					level: server.level,
					ports: server.ports,
				};
				if(server.ports > this.mcp.canOpenPorts()) {
					this.unported_servers.push(unrooted_info);
					this.unported_servers.sort((a,b) => b.level - a.level);
				}
				else {
					this.unrooted_servers.push(unrooted_info);
					this.unrooted_servers.sort((a,b) => b.level - a.level);
				}
			}
		}
	}

	rootedServer(hostname) {
		const unrooted_record = this.rooting_server.pop();
		if(undefined !== unrooted_record) {
			if(unrooted_record.hostname != hostname) {
				this.rooting_server.push(unrooted_record);
			}
		}
		const server = this.getServerData(hostname);
		if(undefined !== server) {
			if(0 < server.max_ram) {
				this.useful_servers.push(hostname);
			}
			else {
				this.useless_servers.push(hostname);
			}
			if(0 < server.max_money) {
				this.hackable_servers.push(hostname);
			}
		}
	}

	getNextRootTarget() {
		if(0 < this.rooting_server.length) {
			const target = this.rooting_server[0];
			return target.hostname;
		}
		else if(0 < this.unrooted_servers.length) {
			const target = this.unrooted_servers.pop();
			this.rooting_server.push(target);
			return target.hostname;
		}
		else if(0 < this.unported_servers.length) {
			const target = this.unported_servers.pop();
			this.rooting_server.push(target);
			return target.hostname;
		}
		return "";
	}

	portsUpdated(ports) {
		this.unported_servers.sort((a, b) => b.ports - a.ports);
		while((0 < this.unported_servers.length) && (ports >= this.unported_servers.at(-1).ports)) {
			const enough_ports = this.unported_servers.pop();
			this.unrooted_servers.push(enough_ports);
		}
		this.unrooted_servers.sort((a, b) => b.level - a.level);
		this.unported_servers.sort((a, b) => b.level - a.level);
	}

	async finishedTask(task) {
		if((task.reserved !== undefined)) {
			for(var host of task.reserved.hosts[Symbol.iterator]()) {
				this.debug(2, "Servers.finishedTask: reserved = " + JSON.stringify(host));
				this.getServerData(host.host).releaseRam(task.id);
			}
		}
	}

	getServerData(name) {
		return this.server_data.get(name);
	}

	async runIdleTask(task, thread_limit) {
		var remaining_threads = thread_limit;
		if(undefined === task.script) {
			if(undefined !== task.action) {
				task.script = "/rpc/" + task.action + ".js";
			}
			else {
				this.ns.print("ERROR: task has no action: task = " + JSON.stringify(task));
			}
		}
		if(this.ns.fileExists(task.script, "home")) {
			task.script_exists = true;
		}
		else {
			this.ns.print("ERROR: Script \"" + task.script + "\" does not exist.");
		}
		var script_ram = this.ns.getScriptRam(task.script);
		for(var host of this.useful_servers[Symbol.iterator]()) {
			const server = this.getServerData(host);
			this.debug(2, "runIdleTask: host = " + host);
			var free_mem = server.freeIdleRam();
			if("home" == host) {
				if(free_mem > this.mcp.reserved_ram) { free_mem -= this.mcp.reserved_ram; }
				else { free_mem = 0; }
			}
			var threads = Math.floor(free_mem / script_ram);
			if((undefined !== remaining_threads) && (threads > remaining_threads)) {
				threads = remaining_threads;
			}
			this.debug(2, "runIdleTask: threads = " + threads);
			if(0 < threads) {
				task.host = host;
				const pid = await this.mcp.directRunRPC(task, threads);
				if(0 == pid) {
					this.ns.print("Failed to start idle task \"" + task.action + "\" on " + host);
				}
				else {
					server.idle_pids.set(pid, threads * script_ram);
				}
				if(undefined !== remaining_threads) { remaining_threads -= threads; }
			}
			if((undefined !== remaining_threads) && (0 == remaining_threads)) { return true; }
		}
		if(undefined === remaining_threads) { return true; }
		return false;
	}

	debug(level, string) {
		if(this.debug_level >= level) {
			this.ns.print("DEBUG: Servers: " + string);
		}
	}
}

class ServerData {
	constructor(servers, hostname, init) {
		this.debug_level = 1;
		this.servers = servers;
		this.hostname = hostname;
		if(init.level !== undefined) { this.level = init.level; }
		if(init.cores !== undefined) { this.cores = init.cores; }
		if(init.ports !== undefined) { this.ports = init.ports; }
		if(init.max_ram !== undefined) { this.max_ram = init.max_ram; }
		if(init.max_money !== undefined) { this.max_money = init.max_money; }
		if(init.root_access !== undefined) { this.root_access = init.root_access; }
		if(init.backdoor !== undefined) { this.backdoor = init.backdoor; }
		if(init.purchased !== undefined) { this.purchased = init.purchased; }
		if(init.location !== undefined) { this.location = init.location; }
		else if("home" != hostname) { this.location = ["home"]; }
		else { this.location = []; }
		if(init.children !== undefined) { this.children = init.children; }
		else { this.children = []; }
		if(init.files !== undefined) { this.files = init.files; }
		else { this.files = []; }
		if(init.links !== undefined) { this.links = init.links; }
		else { this.links = []; }
		this.reserved_memory = new Map();
		this.idle_pids = new Map();
	}
	updateCheck(cur, item, name) {
		if(undefined === item) { return false; }
		if(undefined === cur) { return true; }
		if(cur == item) { return false; }
		this.servers.ns.print("Changing " + name + " in server " + this.hostname + " from " + cur + " to " + item);
		return true;
	}
	update(update) {
		if(this.updateCheck(this.level, update.level, 'level')) { this.level = update.level; }
		if(this.updateCheck(this.cores, update.cores, 'cores')) { this.cores = update.cores; }
		if(this.updateCheck(this.ports, update.ports, 'ports')) { this.ports = update.ports; }
		if(this.updateCheck(this.max_ram, update.max_ram, 'max_ram')) {
			this.max_ram = update.max_ram;
		}
		if(this.updateCheck(this.max_money, update.max_money, 'max_money')) {
			this.max_money = update.max_money;
		}
		if(this.updateCheck(this.root_access, update.root_access, 'root_access')) {
			this.root_access = update.root_access;
		}
		if(this.updateCheck(this.backdoor, update.backdoor, 'backdoor')) {
			this.backdoor = update.backdoor;
		}
		if(this.updateCheck(this.purchased, update.purchased, 'purchased')) {
			this.purchased = update.purchased;
		}
		if(update.location !== undefined) { this.location = update.location; }
		if(update.children !== undefined) { this.children = update.children; }
		if(update.files !== undefined) { this.files = update.files; }
		if(update.links !== undefined) { this.links = update.links; }
	}
	freeRam() {
		this.debug(2, "freeRam: this.max_ram = " + this.max_ram);
		if(this.max_ram === undefined) { return 0; }
		var free_ram = this.max_ram;
		this.debug(2, "freeRam: free_ram = " + free_ram);
		for(const [key, ram] of this.reserved_memory.entries()) {
			var used_ram = ram;
			this.debug(2, "key = " + JSON.stringify(key) + "; used_ram = " + used_ram)
			if(used_ram === undefined) { used_ram = 0; }
			this.debug(2, "freeRam: used_ram = " + used_ram);
			free_ram -= used_ram;
			this.debug(2, "freeRam: free_ram = " + free_ram);
		}
		return free_ram;
	}
	freeIdleRam() {
		var free_ram = this.freeRam();
		for(const ram of this.idle_pids.values()) {
			var used_ram = ram;
			if(used_ram === undefined) { used_ram = 0; }
			free_ram -= used_ram;
		}
		return free_ram;
	}
	async reserveRam(key, amount) {
		await this.killIdleTasks();
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
		this.debug(2, "releaseRam: entries = "
			+ JSON.stringify(Array.from(this.reserved_memory.entries())));
		this.debug(2, "releaseRam: host = " + this.hostname
			+ "; key = " + JSON.stringify(key)
			+ "; entry = " + this.reserved_memory.get(key));
		this.reserved_memory.delete(key);
	}
	async killIdleTasks() {
		var running_pids = [];
		for(var pid of this.idle_pids.keys()) {
			this.servers.ns.kill(pid);
			running_pids.push(pid);
			this.idle_pids.delete(pid);
		}
		while(0 < running_pids) {
			const pid = running_pids.pop();
			while(this.servers.ns.isRunning(pid)) { await this.servers.ns.sleep(100); }
		}
	}

	debug(level, string) {
		if(this.debug_level >= level) {
			this.ns.print("DEBUG: ServerData: " + string);
		}
	}
}
