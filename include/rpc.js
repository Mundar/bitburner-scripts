/** @param {NS} ns */
export class RPC {
	constructor(ns) {
		this.ns = ns;
		this.task = JSON.parse(ns.args[0]);
		this.ports = [20];
		if(this.task.port !== undefined) {
			this.ports = [this.task.port];
		}
		if((undefined !== this.task.ports) && (Array.isArray(this.task.ports))) {
			this.ports = [].concat(this.task.ports);
		}
	}

	async delay() {
		if((undefined !== this.task.delay) && (0 < this.task.delay)) {
			await this.ns.sleep(this.task.delay);
		}
	}

	async exit() {
		this.ns.print("Exiting returning task = " + JSON.stringify(this.task));
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
}

export function start(ns) {
	return JSON.parse(ns.args[0]);
}

export async function exit(ns, task) {
	var ports = [20];
	if(task.port !== undefined) {
		ports = [task.port];
	}
	if(task.ports !== undefined) {
		ports = [].concat(task.ports);
	}
	ns.print("Entering send loop with ports = " + JSON.stringify(ports));
	for(var port of ports[Symbol.iterator]()) {
		ns.print("port = " + port);
		while(!await ns.tryWritePort(port, JSON.stringify(task))) { await ns.sleep(250); }
		ns.print("message sent: task = " + JSON.stringify(task));
	}
}

export async function send(ns, task, message) {
	var ports = [20];
	if(task.port !== undefined) {
		ports = [task.port];
	}
	if(task.ports !== undefined) {
		ports = [].concat(task.ports);
	}
	for(var port of ports[Symbol.iterator]()) {
		while(!await ns.tryWritePort(port, JSON.stringify(message))) { await ns.sleep(250); }
	}
}

// This sends back a text message that the MCP uses to display a log message to its log.
export async function log(ns, task, log_message) {
	var ports = [20];
	if(task.port !== undefined) {
		ports = [task.port];
	}
	if(task.ports !== undefined) {
		ports = [].concat(task.ports);
	}
	var message = {
		type: "log-message",
		action: "mcp-log",
		text: log_message,
		task: task,
	};
	ns.print("Entering send loop with ports = " + JSON.stringify(ports));
	for(var port of ports[Symbol.iterator]()) {
		ns.print("port = " + port);
		while(!await ns.tryWritePort(port, JSON.stringify(message))) { await ns.sleep(250); }
		ns.print("message sent: message = " + JSON.stringify(message));
	}

}