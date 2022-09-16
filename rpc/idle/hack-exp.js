/** @param {NS} ns */                                                                                                                                       
import {RPC} from "/include/rpc.js";

export async function main(ns) {                                                                                                                            
	var rpc = new RPC(ns);
	while(true) {                                                                                                                                       
		let value = await ns.weaken("n00dles");                                                                                                                 
	}                                                                                                                                                   
}