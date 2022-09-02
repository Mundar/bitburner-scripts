/** @param {NS} ns */
export async function main(ns) {
	await ns.wget("https://raw.githubusercontent.com/mundar/bitburner-scripts/master/bin/update.js", "bin/update.js");
}
