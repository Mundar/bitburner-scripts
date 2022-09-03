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

function run_script_on_home(s) {
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

export async function process_unassigned_targets(s) {
	while(0 < s.unassigned_targets.length) {
		const target = s.unassigned_targets.pop();
		var agent;
		if(0 < s.ps_unused.length) {
			agent = s.ps_unused.pop();
		}
		else if(0 < s.ps_idle.length) {
			agent = s.ps_idle.pop();
		}
		else {
			continue;
		}
		s.ps_hacking.push(agent);
		if(s.targets.has(target)) {
			var target_data = s.targets.get(target);
			target_data.agent = agent;
		}
		else {
			const server = s.ns.getServer(target);
			s.targets.set(target, {server: server, agent: agent});
		}
		await copy_to_server(s, "hack.js", agent);
		await copy_to_server(s, "grow.js", agent);
		await copy_to_server(s, "weaken.js", agent);
		await copy_to_server(s, "hack-exp.js", agent);
		await s.ns.scp("mcp-single.js", agent);
		s.ns.exec("mcp-single.js", agent, 1, target)
	}
	s.added_target = false;
}

async function copy_to_server(s, file, target) {
	if(!s.ns.fileExists(file, target)) {
		await s.ns.scp(file, target);
	}
}
