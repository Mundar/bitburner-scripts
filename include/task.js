/** @param {NS} ns */
export class Task {
	constructor(ns, task) {
		this.ns = ns;
		this.data = task;
	}

	clone() {
		var data = JSON.parse(JSON.stringify(this.data));
		data.id = undefined;
		return data;
	}

	copy() {
		return this.data;
	}

	get script() {
		if((this.data.script_exists) && (undefined !== this.data.script)) {
			return this.data.script;
		}
		if(undefined !== this.data.action) {
			this.data.script = "/rpc/" + this.data.action + ".js";
		}
		else if(undefined !== this.data.server) {
			this.data.script = "/rpc/servers/" + this.data.server + ".js";
		}
		else if(undefined !== this.data.service) {
			this.data.script = "/rpc/services/" + this.data.service + ".js";
		}
		else {
			return undefined;
		}
		if(undefined !== this.data.script) {
			if(this.ns.fileExists(this.data.script)) {
				this.data.script_exists = true;
				return this.data.script;
			}
		}
		return undefined;
	}
}
