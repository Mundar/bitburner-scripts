/** @param {NS} ns */
export async function main(ns) {
	if(ns.args.length < 2) {
		ns.tprint("USAGE: try-rpc <server> <script> [target] [JSON]");
		ns.exit();
	}
	
	const host = ns.args[0];

	if(!ns.serverExists(host)) {
		ns.tprint("ERROR: Server \"" + host + "\" doesn't exist");
		ns.exit();
	}

	const script = "/rpc/" + ns.args[1] + ".js";

	if(ns.fileExists(script, "home")) {
		if(host != "home") {
			await ns.scp("/include/formatting.js", host, "home");
			await ns.scp("/include/rpc.js", host, "home");
			await ns.scp(script, host, "home");
		}
	}
	else {
		ns.tprint("ERROR: Script file " + script + " doesn't exist on home");
		ns.exit();
	}

	var task = { host: host, action: ns.args[1], port: 1 };
	if((ns.args[2] !== undefined) && (ns.args[2] != "")) {
		task.target = ns.args[2];
	}

	if(ns.args[3] !== undefined) {
		const temp = JSON.parse(ns.args[3]);
		Object.assign(task, temp);
	}

	var port = ns.getPortHandle(1);

	var pid = ns.exec(script, host, 1, JSON.stringify(task));
	if(0 == pid) {
		ns.tprint("Failed to start script " + script + " on " + host);
		ns.exit();
	}
	
	var wait_time = 0;
	while(port.empty()) {
		await ns.sleep(100);
		wait_time++;
		if((wait_time % 20) == 0) {
			if(!ns.isRunning(pid)) {
				ns.tprint("Script \"" + script + "\" is no longer running, but didn't return a message.");
				ns.exit();
			}
		}
	}
	ns.tprint(script + " returns " + port.read());
}