/** @param {NS} ns */
export async function main(ns) {
	const host = ns.args[0];
	const target = ns.args[1];
	await copy_to_server(ns, "hack.js", host);
	await copy_to_server(ns, "grow.js", host);
	await copy_to_server(ns, "weaken.js", host);
	await copy_to_server(ns, "hack-exp.js", host);
	await ns.scp("mcp-single.js", host);
	ns.exec("mcp-single.js", host, 1, target)
}

async function copy_to_server(ns, file, target) {
	if(!ns.fileExists(file, target)) {
		await ns.scp(file, target);
	}
}