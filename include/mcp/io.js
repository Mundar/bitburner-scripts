/** @param {NS} ns */
export class IO {
	constructor(ns, port) {
		this.ns = ns;
		this.port = port;
		this.port_handle = ns.getPortHandle(port);
		this.port_handle.clear();
		this.queue = [];
	}

	checkPort() {
		var count = 0;
		while(!this.port_handle.empty()) {
			this.queue.push(this.port_handle.read());
			count++;
		}
		return count;
	}

	messageAvailable() {
		this.checkPort();
		return (this.queue.length != 0);
	}

	getMessage() {
		return this.queue.shift();
	}

	async waitForMessage() {
		while(!messageAvailable()) {  }
	}
}
