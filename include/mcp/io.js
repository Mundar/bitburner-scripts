/** @param {NS} ns */
export class IO {
	constructor(port_handle) {
		this.port = port_handle;
		this.port.clear();
		this.queue = [];
	}

	checkPort() {
		var count = 0;
		while(!this.port.empty()) {
			this.queue.push(this.port.read());
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
}