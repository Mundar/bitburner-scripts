/** @param {NS} ns */
export async function main(ns) {
	const player = ns.getPlayer();
	ns.tprint("bitNodeN = " + player.bitNodeN);
	ns.tprint("city = " + player.city);
	ns.tprint("entropy = " + player.entropy);
	printSkills(ns, "Experience", player.exp);
	ns.tprint("factions = " + player.factions.join(', '));
	ns.tprint("hasCorporation = " + player.hasCorporation);
	ns.tprint("HP = " + player.hp.current + "/" + player.hp.max);	
	ns.tprint("inBladeburner = " + player.inBladeburner);
	ns.tprint("jobs = " + JSON.stringify(player.jobs));
	ns.tprint("location = " + player.location);
	ns.tprint("money = " + player.money);
	printMultipliers(ns, "Multipliers", player.mults);
	ns.tprint("numPeopleKilled = " + player.numPeopleKilled);
	ns.tprint("playtimeSinceLastAug = " + player.playtimeSinceLastAug);
	ns.tprint("playtimeSinceLastBitnode = " + player.playtimeSinceLastBitnode);
	printSkills(ns, "Skills", player.skills);
	ns.tprint("tor = " + player.tor);
	ns.tprint("totalPlaytime = " + player.totalPlaytime);
}

function printSkills(ns, title, skills) {
	ns.tprint(title + ":");
	ns.tprint("  agility = " + skills.agility);
	ns.tprint("  charisma = " + skills.charisma);
	ns.tprint("  defense = " + skills.defense);
	ns.tprint("  dexterity = " + skills.dexterity);
	ns.tprint("  hacking = " + skills.hacking);
	ns.tprint("  intelligence = " + skills.intelligence);
	ns.tprint("  strength = " + skills.strength);
}

function printMultipliers(ns, title, mults) {
	ns.tprint(title + ":");
	ns.tprint("  agility_exp = " +  mults.agility_exp);
	ns.tprint("  agility = " +  mults.agility);
	ns.tprint("  bladeburner_analysis = " +  mults.bladeburner_analysis);
	ns.tprint("  bladeburner_max_stamina = " +  mults.bladeburner_max_stamina);
	ns.tprint("  bladeburner_stamina_gain = " +  mults.bladeburner_stamina_gain);
	ns.tprint("  bladeburner_success_chance = " +  mults.bladeburner_success_chance);
	ns.tprint("  charisma_exp = " +  mults.charisma_exp);
	ns.tprint("  charisma = " +  mults.charisma);
	ns.tprint("  company_rep = " +  mults.company_rep);
	ns.tprint("  crime_money = " +  mults.crime_money);
	ns.tprint("  crime_success = " +  mults.crime_success);
	ns.tprint("  defense_exp = " +  mults.defense_exp);
	ns.tprint("  defense = " +  mults.defense);
	ns.tprint("  dexterity_exp = " +  mults.dexterity_exp);
	ns.tprint("  dexterity = " +  mults.dexterity);
	ns.tprint("  faction_rep = " +  mults.faction_rep);
	ns.tprint("  hacking_chance = " +  mults.hacking_chance);
	ns.tprint("  hacking_exp = " +  mults.hacking_exp);
	ns.tprint("  hacking_grow = " +  mults.hacking_grow);
	ns.tprint("  hacking_money = " +  mults.hacking_money);
	ns.tprint("  hacking_speed = " +  mults.hacking_speed);
	ns.tprint("  hacking = " +  mults.hacking);
	ns.tprint("  hacknet_node_core_cost = " +  mults.hacknet_node_core_cost);
	ns.tprint("  hacknet_node_level_cost = " +  mults.hacknet_node_level_cost);
	ns.tprint("  hacknet_node_money = " +  mults.hacknet_node_money);
	ns.tprint("  hacknet_node_purchase_cost = " +  mults.hacknet_node_purchase_cost);
	ns.tprint("  hacknet_node_ram_cost = " +  mults.hacknet_node_ram_cost);
	ns.tprint("  strength_exp = " +  mults.strength_exp);
	ns.tprint("  strength = " +  mults.strength);
	ns.tprint("  work_money = " +  mults.work_money);
}