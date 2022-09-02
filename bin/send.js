/** @param {NS} ns */
export async function main(ns) {
	const message = ns.args.join(' ');
	const hostname = ns.getHostname();
	ns.writePort(20, hostname + " " + message);
}
