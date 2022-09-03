/** @param {NS} ns */
import * as fmt from "include/formatting.js";
import {set_idle_script, changed_idle} from "include/mcp/idle.js";

export async function handle_messages(s) {
	if(!s.port.empty()) {
		var tokens = s.port.read().split(' ');
		const from_host = tokens.shift();
		const message = [].concat(tokens).join(" ");
		const command = tokens.shift();
		s.ns.print("Message \"" + message + "\" received from " + from_host);
		if(command == "status") {
			process_status(s);
		}
		else if(command == "set") {
			await process_set(s, tokens);
		}
		else if(command == "list") {
			await process_list(s);
		}
		else if(command == "find") {
			process_find(s, tokens);
		}
		else if(command == "target") {
			process_target(s, tokens);
		}
		else if(command == "help") {
			if(0 == tokens.length) {
				s.ns.tprint("  find    Find location of specified server");
				s.ns.tprint("  list    List servers to terminal");
				s.ns.tprint("  set     Set internal value");
				s.ns.tprint("  status  Display status information");
				s.ns.tprint("  target  Add server to the targeted server list");
			}
			else {
				const help_command = tokens.shift();
				if(help_command == "set") {
					s.ns.tprint("  idle    Set idle script: set idle hack-exp.js");
				}
			}
		}
		else {
			s.ns.print("Unrecognized command: " + command)
			s.ns.tprint("Unrecognized command: " + command)
		}
	}
}

async function process_set(s, tokens) {
	const set_command = tokens.shift();
	if(set_command == "idle") {
		set_idle_script(s, tokens.shift());
		await changed_idle(s);
	}
	else {
		s.ns.print("Unsupported set command: " + set_command + " " + tokens.join(" "));
	}
}

function process_find(s, tokens) {
	const target = tokens.shift();
	const server = s.remote.get(target);
	if(server !== undefined) {
		var backtrack = [target];
		for(var i = server.location.length; i > 0; i--) {
			const link = s.ns.getServer(server.location[i-1]);
			backtrack.push(link.hostname);
			if(link.backdoorInstalled || link.isConnectedTo) {
				i = 1;
			}
		}
		s.ns.tprint("Find: " + target + ": " + backtrack.reverse().join("->"));
	}
}

function process_list(s) {
	for(var [key, value] of s.remote.entries()) {
		s.ns.tprint(fmt.align_left(key, 20) + fmt.align_right(value.server.requiredHackingSkill, 5) + fmt.align_right("$" + fmt.commafy(value.server.moneyMax), 25));
	}
}

function process_target(s, tokens) {
	while(0 < tokens.length) {
		const target = tokens.shift();
		const server = s.ns.getServer(target);
		if(server !== undefined) {
			s.unassigned_targets.push(target);
			s.targets.set(target, { server: server });
			s.added_target = true;
		}
	}
}

function process_status(s) {
	s.ns.tprint("Rooted Servers: " + s.rooted.length);
	if(0 < s.rs_unused.length) { s.ns.tprint("  Unused: " + fmt.align_right(s.rs_unused.length, 3)); }
	if(0 < s.rs_idle.length) { s.ns.tprint("  Idle:    " + fmt.align_right(s.rs_idle.length, 3)); }
	if(0 < s.rs_weaken.length) { s.ns.tprint("  Weaken:  " + fmt.align_right(s.rs_weaken.length, 3)); }
	if(0 < s.rs_useless.length) { s.ns.tprint("  Useless: " + fmt.align_right(s.rs_useless.length, 3)); }
	s.ns.tprint("Unrooted Servers: " + s.unrooted.length);
	if(0 == s.unrooted.length) {}
	else if(0 < s.needed_cracks.length) {
		s.ns.tprint("  Waiting for a new port opening program: ");
		s.ns.tprint("    " + s.needed_cracks);
	}
	else {
		s.ns.tprint("  Waiting for Hacking Level " + s.next_hacking_level);
	}
	const ps_total = s.ps_unused.length + s.ps_idle.length + s.ps_hacking.length;
	s.ns.tprint("Purchased servers: " + ps_total);
	if(0 < s.ps_unused.length) { s.ns.tprint("  Unused:  " + fmt.align_right(s.ps_unused.length, 3)); }
	if(0 < s.ps_idle.length) { s.ns.tprint("  Idle:    " + fmt.align_right(s.ps_idle.length, 3)); }
	if(0 < s.ps_hacking.length) { s.ns.tprint("  Hacking: " + fmt.align_right(s.ps_hacking.length, 3)); }
	s.ns.tprint("Home Server:");
	s.ns.tprint("  Reserved RAM: " + fmt.align_right(s.home_reserved, 8));
}
