/** @param {NS} ns */
export async function main(ns) {
	const message = {
		host: ns.getHostname(),
		action: "user",
		command: ns.args.join(' ').split(' '),
	};
	ns.writePort(20, JSON.stringify(message));
}