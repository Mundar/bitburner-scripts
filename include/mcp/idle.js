/** @param {NS} ns */
export async function changed_idle(s) {
	while(0 < s.rs_idle.length) {
		const server = s.rs_idle.pop();
		s.ns.killall(server);
		s.rs_unused.push(server);
	}
	while(0 < s.ps_idle.length) {
		const server = s.ps_idle.pop();
		s.ns.killall(server);
		s.ps_unused.push(server);
	}
	await added_unused_server(s);
}

export async function added_unused_server(s) {
	if((s.idle_script !== undefined) && (0 < s.idle_script.length)) {
		while(0 < s.ps_unused.length) {
			const server = s.ps_unused.pop();
			await run_script_on_server(s, server);
			s.ps_idle.push(server);
		}
		while(0 < s.rs_unused.length) {
			const server = s.rs_unused.pop();
			await run_script_on_server(s, server);
			s.rs_idle.push(server);
		}
	}
}

export function set_idle_script(s, script) {
	if((script !== undefined) && (script != "") && (s.ns.fileExists(script, "home"))) {
		s.idle_ram = s.ns.getScriptRam(script);
		s.idle_script = script;
	}
	else if((script == "") || (script === undefined)) {
		s.idle_ram = 0;
		s.idle_script = "";
	}
	else {
		s.ns.print("Script \"" + script + "\" does not exist.")
	}
}

async function run_script_on_server(s, server) {
	const srvr = s.ns.getServer(server);
	await s.ns.scp(s.idle_script, server);
	var server_ram = srvr.maxRam - srvr.ramUsed;
	var threads = Math.floor(server_ram / s.idle_ram);
	if (0 < threads) {
		s.ns.exec(s.idle_script, server, threads);
	}
}

async function run_script_on_home(s) {
	const server = s.ns.getServer("home");
	var server_ram = server.maxRam - s.home_reserved - server.ramUsed;
	if(server_ram > s.home_idle) {
		server_ram = s.home_idle;
	}
	var threads = Math.floor(server_ram / s.idle_ram);
	if (0 < threads) {
		s.ns.exec(s.idle_script, "home", threads);
	}
}
