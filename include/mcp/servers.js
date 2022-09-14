/** @param {NS} ns */
export class Servers {
	constructor(ns, mcp) {
		this.ns = ns;
		this.mcp = mcp;
		this.server_data = new Map();
		this.home_server = new Server(this, "home", {})
		this.useful_servers = [];
		this.useless_servers = [];
		this.purchased_servers = [];
		this.rooted_servers = [];
		this.rooting_server = [];
		this.unrooted_servers = [];
		this.unported_servers = [];
		this.reserved = {
			host: '',
			ram: 0,
		};
		this.debug = true;
	}

	staticMemory(ram, host) {
		var server = this.getServerData(host);
		server.reserveRam(0, ram);
	}

	reserveMemory(ram, requested_threads, task) {
		this.debugMsg("reserveMemory: ram = " + ram
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
		this.debugMsg("reserveMemory: task = " + JSON.stringify(task));
		for(var host of this.useful_servers[Symbol.iterator]()) {
			var server = this.getServerData(host);
			var free_mem = server.freeRam();
			var threads = Math.floor(free_mem / ram);
			if(threads > remaining_threads) { threads = remaining_threads; }
			if(0 < threads) {
				if(undefined === task.host)	{ task.host = host; }
				const ram_used = ram * threads;
				server.reserveRam(task.id, ram_used);
				task.reserved.total_ram += ram_used;
				task.reserved.total_threads += threads;
				task.reserved.hosts.push({ host: host, ram: ram_used, threads: threads });
				remaining_threads -= threads;
			}
			if(0 == remaining_threads) { return true; }
		}
		return false;
	}

	updateServer(hostname, details) {
		if(this.server_data.has(hostname)) {
			let server = this.server_data.get(hostname);
			server.update(details)
		}
		else {
			let server = new Server(this, hostname, details);
			this.server_data.set(hostname, server);
			if(server.root_access) {
				if(0 < server.max_ram) {
					this.useful_servers.push(hostname);
				}
				else {
					this.useless_servers.push(hostname);
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
				this.debugMsg("Servers.finishedTask: reserved = " + JSON.stringify(host));
				this.getServerData(host.host).releaseRam(task.id);
			}
		}
	}

	getServerData(name) {
		return this.server_data.get(name);
	}

	async runIdleTask(task, thread_limit) {
		var remaining_threads = thread_limit;
		for(var host of this.useful_servers[Symbol.iterator]()) {
			var server = this.getServerData(host);
			var free_mem = server.freeRam();
			if("home" == host) {
				if(free_mem > 16) { free_mem -= 16; }
				else { free_mem = 0; }
			}
			var threads = Math.floor(free_mem / ram);
			if((undefined != remaining_threads) && (threads > remaining_threads)) {
				threads = remaining_threads;
			}
			if(0 < threads) {
				if(undefined === task.host)	{ task.host = host; }
				if(undefined !== remaining_threads) { remaining_threads -= threads; }
			}
			if(0 == remaining_threads) { return true; }
		}
		return false;		
	}

	iterateHosts(func) {
		var output;
		for(const [hostname, data] of this.server_data.entries()) {
			if(!func(hostname, data, output)) {
				return output;
			}
		}
		func("home", this.home_server, output);
		return output;
	}

	chooseHost2(script_ram) {
		var result = this.iterateHosts(function(h, d, o) { return chooseHostFunction(h, d, o); }); 
		if(result == undefined) { result = ""; }
		return result;
	}

	debugMsg(string) {
		if(this.debug) {
			this.ns.print("DEBUG: " + string);
		}
	}
}

function chooseHostFunction(servers, host, info, output) {
	if(info.freeRam() >= script_ram) {
		output = host;
		return false;
	}
	return true;	
}

class Server {
	constructor(servers, hostname, init) {
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
		this.idle_pids = [];
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
		this.servers.debugMsg("freeRam: this.max_ram = " + this.max_ram);
		if(this.max_ram === undefined) { return 0; }
		var free_ram = this.max_ram;
		this.servers.debugMsg("freeRam: free_ram = " + free_ram);
		for(const [key, ram] of this.reserved_memory.entries()) {
			var used_ram = ram;
			this.servers.debugMsg("key = " + JSON.stringify(key) + "; used_ram = " + used_ram)
			if(used_ram == undefined) { used_ram = 0; }
			this.servers.debugMsg("freeRam: used_ram = " + used_ram);
			free_ram -= used_ram;
			this.servers.debugMsg("freeRam: free_ram = " + free_ram);
		}
		return free_ram;
	}
	reserveRam(key, amount) {
		this.servers.debugMsg("reserveRam: host = " + this.hostname + "; key = " + JSON.stringify(key) + "; amount = " + amount + "; entry = " + this.reserved_memory.get(key));
		if(this.reserved_memory.has(key)) {
			const cur_amount = this.reserved_memory.get(key);
			this.reserved_memory.set(key, cur_amount + amount);
		}
		else {
			this.reserved_memory.set(key, amount);
		}
	}
	releaseRam(key) {
		this.servers.debugMsg("releaseRam: entries = "
			+ JSON.stringify(Array.from(this.reserved_memory.entries())));
		this.servers.debugMsg("releaseRam: host = " + this.hostname
			+ "; key = " + JSON.stringify(key)
			+ "; entry = " + this.reserved_memory.get(key));
		this.reserved_memory.delete(key);
	}
}