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
		else {
			s.ns.print("Unrecognized command: " + command)
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

function process_status(s) {
	s.ns.print("Rooted Servers: " + s.rooted.length);
	if(0 < s.rs_unused.length) { s.ns.print("  Unused: " + fmt.align_right(s.rs_unused.length, 3)); }
	if(0 < s.rs_idle.length) { s.ns.print("  Idle:    " + fmt.align_right(s.rs_idle.length, 3)); }
	if(0 < s.rs_weaken.length) { s.ns.print("  Weaken:  " + fmt.align_right(s.rs_weaken.length, 3)); }
	if(0 < s.rs_useless.length) { s.ns.print("  Useless: " + fmt.align_right(s.rs_useless.length, 3)); }
	s.ns.print("Unrooted Servers: " + s.unrooted.length);
	if(0 == s.unrooted.length) {}
	else if(0 < s.needed_cracks.length) {
		s.ns.print("  Waiting for a new port opening program: ");
		s.ns.print("    " + s.needed_cracks);
	}
	else {
		s.ns.print("  Waiting for Hacking Level " + s.next_hacking_level);
	}
	const ps_total = s.ps_unused.length + s.ps_idle.length + s.ps_hacking.length;
	s.ns.print("Purchased servers: " + ps_total);
	if(0 < s.ps_unused.length) { s.ns.print("  Unused:  " + fmt.align_right(s.ps_unused.length, 3)); }
	if(0 < s.ps_idle.length) { s.ns.print("  Idle:    " + fmt.align_right(s.ps_idle.length, 3)); }
	if(0 < s.ps_hacking.length) { s.ns.print("  Hacking: " + fmt.align_right(s.ps_hacking.length, 3)); }
	s.ns.print("Home Server:");
	s.ns.print("  Reserved RAM: " + fmt.align_right(s.home_reserved, 8));
	s.ns.print("  Idle RAM:     " + fmt.align_right(s.home_idle, 8));
	s.ns.print("Player:");
	s.ns.print("  Hacking Level:      " + fmt.align_right(s.player.skills.hacking, 30));
	s.ns.print("  Intelligence Level: " + fmt.align_right(s.player.skills.intelligence, 30));
	s.ns.print("  Player money:       $" + fmt.align_right(fmt.commafy(s.player.money), 30));
} 
