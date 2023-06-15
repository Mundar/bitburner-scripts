/** @param {NS} ns */
import {Service} from "/include/server.js";
import * as fmt from "/include/formatting.js";

export async function main(ns) {
	ns.disableLog("sleep");
	ns.disableLog("getServerMoneyAvailable");
	var service = new Service(ns);

	service.addCommand("status", function(s, msg) { status(s, msg); });
	service.addCommand("sell-now", function(s, msg) { s.task.sell_now = true; });
	service.addCommand("sell-mode", function(s, msg) { sell_mode_command(s, msg); });
	service.addCommand("sell-shares", SellOptions.sell_shares_command_func());
	service.addCommand("fast-print", function(s, msg) {
		msg.rest.unshift('fast');
		sell_mode_command(s, msg);
		msg.rest.unshift('print');
		notify_mode_command(s, msg);
	});
	service.addCommand("notify-mode", function(s, msg) { notify_mode_command(s, msg); });
	service.addCommand("new-city", async function(s, msg) { await CorpData.newCityFunc(s, msg); });
	service.addCommand("new-division", async function(s, msg) { await CorpData.newDivisionFunc(s, msg); });
	service.addCommand("new-size", async function(s, msg) { await CorpData.newSizeFunc(s, msg); });
	service.addCommand("view-size", function(s, msg) { CorpData.viewSizesFunc(s, msg); });
	service.addCommand("set-employees", async function(s, msg) { await CorpData.setEmployeesFunc(s, msg); });
	service.addCommand("set-upgrade-cost", async function(s, msg) { await CorpData.setUpgradeCostFunc(s, msg); });
	service.addCommand("set-upgrade-level", async function(s, msg) { await CorpData.setUpgradeLevelFunc(s, msg); });
	service.addCommand("test", function(s, msg) { CorpData.testFunc(s, msg); });
	service.addCommand("test-prompts", async function(s, msg) { await CorpData.testPromptsFunc(s, msg); });
	service.addCommand("test-research", async function(s, msg) { await CorpData.testResearchFunc(s, msg); });
	service.addTask(buy_sell_shares_func(), {});
	service.addTask(function(s, data) { CorpData.updateResearchTask(s, data); }, {}, 5000);

	await service.start();

	await service.exit();
}

function notify(s, message) {
	var notify_mode = s.task.notify_mode;
	if(undefined === notify_mode) {
		notify_mode = "toast";
		s.task.notify_mode = "toast";
	}
	switch(notify_mode) {
		case "log":
			s.ns.print(message);
			break;
		case "print":
			s.ns.tprint(message);
			// Also toast in print mode. . .
		case "toast":
			s.ns.toast(message, "info", 5000);
			break;
	}
}

function notify_mode_string(notify_mode) {
	switch(notify_mode) {
		case "none": return "don't notify";
		case "log": return "send to log";
		case "print": return "print to terminal";
		case "toast": return "toast";
		default: return "Unknown: \"" + notify_mode + "\"";
	}
}

function notify_mode_command(s, msg) {
	const new_mode = msg.rest.shift();
	if(undefined === new_mode) {
		var notify_mode = s.task.notify_mode;
		if(undefined === notify_mode) {
			notify_mode = "toast";
			s.task.notify_mode = "toast";
		}
		s.ns.tprint("Current share sell mode = " + notify_mode_string(notify_mode));
		s.ns.tprint("Notify Modes:");
		s.ns.tprint("  none   Don't notify");
		s.ns.tprint("  log    Log notifications");
		s.ns.tprint("  print  Print notifications to the terminal");
		s.ns.tprint("  toast  Display notifications at the lower right");
	}
	else {
		switch(new_mode) {
			case "none":
			case "log":
			case "print":
			case "toast":
				s.ns.tprint("Setting notify mode to " + notify_mode_string(new_mode));
				break;
			default:
				s.ns.tprint("Unsuported sell mode: \"" + new_mode + "\"");
				return;
		}
		s.task.notify_mode = new_mode;
	}
}

function sell_mode_string(sell_mode) {
	switch(sell_mode) {
		case "none": return "Don't Sell";
		case "slow": return "Maximize Money";
		case "fast": return "Buy after Sell";
		case "deprecated": return "Deprecated Sell Mode (from version 2.0.2)";
		default: return "Unknown: \"" + sell_mode + "\"";
	}
}

function sell_mode_command(s, msg) {
	const new_mode = msg.rest.shift();
	var sell = new SellOptions(s);
	if(undefined === new_mode) {
		s.ns.tprint("Current share sell mode = " + sell_mode_string(sell.sell_mode));
		s.ns.tprint("Sell Modes:");
		s.ns.tprint("  none  Don't sell (Used when planning to install augments)");
		s.ns.tprint("  slow  Buy back shares at lowest share price");
		s.ns.tprint("  fast  Buy back shares immediately after selling");
	}
	else {
		switch(new_mode) {
			case "none":
			case "slow":
			case "fast":
			case "grow":
			case "deprecated":
				s.ns.tprint("Setting sell mode to " + sell_mode_string(new_mode));
				break;
			default:
				s.ns.tprint("Unsuported sell mode: \"" + new_mode + "\"");
				return;
		}
		s.task.sell_mode = new_mode;
		s.task.min_share_price = undefined;
		s.task.max_share_price = undefined;
		s.task.last_share_price = undefined;
	}
}

function buy_sell_shares_func() {
	return function(s, data) { buy_sell_shares(s, data); }
}

function buy_sell_shares(s, data) {
	var corporation = s.ns.corporation.getCorporation();
	const owned_shares = corporation.numShares;
	const issued_shares = corporation.issuedShares;
	const share_price = corporation.sharePrice;
	var sell = new SellOptions(s);
	const sell_mode = sell.sell_mode;
	var sleep_time = 60000;
	if((0 == issued_shares) && ("deprecated" == sell_mode)) {
		// We bought all shares back and set dividend to 5% to raise the stock price.
		const cooldown = corporation.shareSaleCooldown;
		if(cooldown > 0) {
			sleep_time = (cooldown * 200);
			notify(s, "Sleeping for " + s.ns.tFormat(sleep_time) + " waiting for sell cooldown.");
		}
		else {
			notify(s, "Time to sell 1,000,000 shares to raise price");
			const price_before = share_price;
			const before_money = s.ns.getServerMoneyAvailable("home");
			s.ns.corporation.sellShares(1000000);
			const after_money = s.ns.getServerMoneyAvailable("home");
			const price_after = s.ns.corporation.getCorporation().sharePrice;
			s.ns.print("Sold 1,000,000 shares at $" + fmt.notation(price_before) + " for a total of $" + fmt.notation(after_money - before_money));
			s.ns.print("Share price changed from $" + fmt.notation(price_before) + " to $" + fmt.notation(price_after));
		}
	}
	else if(owned_shares > issued_shares) {
		s.task.min_share_price = undefined;
		var normal_sell = true;
		if(s.task.sell_now) { normal_sell = false; }
		if(normal_sell && ("none" == sell_mode)) {
			sleep_time = 120000;
			var change_text = "";
			if(undefined !== s.task.last_share_price) {
				change_text += " (" + fmt.decimal(((share_price / s.task.last_share_price) - 1) * 100, 3) + "% change)";
			}
			notify(s, "Current share price is $" + fmt.notation(share_price) + change_text);
			s.task.last_share_price = share_price;
		}
		else if(normal_sell && (undefined === s.task.max_share_price)) {
			notify(s, "Initial share price is $" + fmt.notation(share_price));
			s.task.max_share_price = share_price;
			s.task.not_higher_count = 0;
		}
		else if(normal_sell && (share_price > s.task.max_share_price)) {
			var change_text = "";
			if(undefined !== s.task.max_share_price) {
				change_text += " (" + fmt.decimal(((share_price / s.task.max_share_price) - 1) * 100, 3) + "% change)";
			}
			notify(s, "Share price raised to $" + fmt.notation(share_price) + change_text);
			s.task.max_share_price = share_price;
			s.task.not_higher_count = 0;
		}
		else {
			if(normal_sell && (sell.limit_count > s.task.not_higher_count)) {
				notify(s, "Share price below highest seen (" + fmt.notation(share_price) + " < " + fmt.notation(s.task.max_share_price) + ") " + s.task.not_higher_count + " times.");
				s.task.not_higher_count += 1;
				sleep_time = 10000;
			}
			else {
				const cooldown = corporation.shareSaleCooldown;
				if(cooldown > 0) {
					sleep_time = (cooldown * 200) - 290000;
					if(sleep_time < 0) {
						s.task.not_higher_count = Math.floor((0 - sleep_time) / 10000);
						sleep_time = 0;
					}
					else {
						s.task.not_higher_count = 0;
					}
					notify(s, "Sleeping for " + s.ns.tFormat(sleep_time) + " waiting for sell cooldown.");
				}
				else {
					const price_before = share_price;
					const before_money = s.ns.getServerMoneyAvailable("home");
					const shares_to_sell = sell.sell_shares;
					notify(s, "Selling " + fmt.commafy(shares_to_sell, 0) + " shares");
					s.ns.corporation.sellShares(shares_to_sell);
					const after_money = s.ns.getServerMoneyAvailable("home");
					const price_after = s.ns.corporation.getCorporation().sharePrice;
					s.ns.print("Sold " + fmt.commafy(shares_to_sell, 0) + " shares at $" + fmt.notation(price_before) + " for a total of $" + fmt.notation(after_money - before_money));
					s.ns.print("Share price changed from $" + fmt.notation(price_before) + " to $" + fmt.notation(price_after));
					s.ns.print("Time since last augmentation installation is " + s.ns.tFormat(Date.now() - s.ns.getResetInfo().lastAugReset));
					switch(sell_mode) {
						case "slow":
						case "deprecated":
							s.ns.corporation.issueDividends(0.90);
							break;
						default:
							sleep_time = 1000;
							break;
					}
					s.task.sell_now = false;
				}
			}
		}
	}
	else {
		s.task.max_share_price = undefined;
		var min_buy = true;
		switch(sell_mode) {
			case "none":
			case "fast":
				min_buy = false;
		}
		if(min_buy && (undefined === s.task.min_share_price)) {
			notify(s, "Initial share price is $" + fmt.notation(share_price));
			s.task.min_share_price = share_price;
			s.task.not_lower_count = 0;
		}
		else if(min_buy && (share_price < s.task.min_share_price)) {
			var change_text = "";
			if(undefined !== s.task.min_share_price) {
				change_text += " (" + fmt.decimal(((share_price / s.task.min_share_price) - 1) * 100, 3) + "% change)";
			}
			notify(s, "Share price dropped to $" + fmt.notation(share_price) + change_text);
			s.task.min_share_price = share_price;
			s.task.not_lower_count = 0;
		}
		else {
			if(min_buy && (sell.limit_count > s.task.not_lower_count)) {
				notify(s, "Share price above lowest seen ($" + fmt.notation(share_price) + " > $" + fmt.notation(s.task.min_share_price) + ") " + s.task.not_lower_count + " times.");
				s.task.not_lower_count += 1;
				sleep_time = 10000;
			}
			else {
				if("none" == sell_mode) {
					sleep_time = 120000;
					var change_text = "";
					if(undefined !== s.task.last_share_price) {
						change_text += " (" + fmt.decimal(((share_price / s.task.last_share_price) - 1) * 100, 3) + "% change)";
					}
					notify(s, "Current share price is $" + fmt.notation(share_price) + change_text);
					s.task.last_share_price = share_price;
				}
				else {
					notify(s, "Buy " + fmt.commafy(issued_shares, 0) + " shares and set dividends to 5% to start raising share price");
					const before_money = s.ns.getServerMoneyAvailable("home");
					s.ns.corporation.buyBackShares(issued_shares);
					const after_money = s.ns.getServerMoneyAvailable("home");
					s.ns.print("Bought back " + fmt.commafy(issued_shares, 0) + " shares at $" + fmt.notation(share_price) + " for a total of $" + fmt.notation(before_money - after_money));
					s.ns.print("Time since last augmentation installation is " + s.ns.tFormat(Date.now() - s.ns.getResetInfo().lastAugReset));
					s.ns.corporation.issueDividends(0.05);
				}
			}
		}
	}
	s.addTask(buy_sell_shares_func(), data, sleep_time);
}

function status(s, msg) {
	const corporation = s.ns.corporation.getCorporation();
	s.ns.tprint("Name = " + corporation.name);
	s.ns.tprint("Owned shares = " + fmt.notation(corporation.numShares));
	s.ns.tprint("Issued shares = " + fmt.notation(corporation.issuedShares));
	s.ns.tprint("Share price = " + fmt.notation(corporation.sharePrice));
	s.ns.tprint("Dividend rate = " + corporation.dividendRate);
	s.ns.tprint("Sale cooldown = " + s.ns.tFormat(corporation.shareSaleCooldown * 200));
}

class SellOptions {
	static default_sell_mode = "none";
	static default_keep_shares = 50000000;
	static default_limit_count = 6;
	constructor(s) {
		this.s = s;
	}

	//////////////////////////////////////////////////////////////////////////////
	// Mode
	//////////////////////////////////////////////////////////////////////////////
	get sell_mode() {
		if(undefined === this.s.task.sell_mode) { this.s.task.sell_mode = SellOptions.default_sell_mode; }
		return this.s.task.sell_mode;
	}

	//////////////////////////////////////////////////////////////////////////////
	// Shares
	//////////////////////////////////////////////////////////////////////////////
	get sell_shares() {
		const corporation = this.s.ns.corporation.getCorporation();
		return corporation.numShares - this.keep_shares;
	}
	get keep_shares() {
		if(undefined === this.s.task.keep_shares) { this.s.task.keep_shares = SellOptions.default_keep_shares; }
		return this.s.task.keep_shares;
	}
	static sell_shares_command_func() {
		return function (s, msg) { SellOptions.sell_shares_command(s, msg); };
	}
	static sell_shares_command(s, msg) {
		const corporation = s.ns.corporation.getCorporation();
		const max_shares = corporation.numShares + corporation.issuedShares;
		const half_shares = Math.floor(max_shares / 2) - 1
		var sell_opts = new SellOptions(s);
		const sell_shares = sell_opts.sell_shares;
		const shares_input = msg.rest.shift();
		if(undefined === shares_input) {
			s.ns.tprint("Maximum shares: " + fmt.commafy(max_shares));
			s.ns.tprint("Current shares: " + fmt.commafy(corporation.numShares));
			s.ns.tprint("Sell shares: " + fmt.commafy(sell_shares));
			s.ns.tprint("Keep shares: " + fmt.commafy(s.task.keep_shares));
			s.ns.tprint("USAGE: mcp corp sell-shares <new keep shares>");
			return;
		}
		const new_shares = Number.parseInt(shares_input);
		if(new_shares > half_shares) {
			s.ns.tprint("New shares must be less than or equal to " + fmt.commafy(half_shares));
			return;
		}
		else if(new_shares < 0) {
			s.ns.tprint("New shares must be greater than or equal to zero");
			return;
		}
		s.task.keep_shares = new_shares;
	}

	//////////////////////////////////////////////////////////////////////////////
	// Limit Count
	//////////////////////////////////////////////////////////////////////////////
	get limit_count() {
		if(undefined === this.s.task.sell_limit_count) { this.s.task.sell_limit_count = SellOptions.default_limit_count; }
		return this.s.task.sell_limit_count;
	}
}

const ALL_CITIES = ["Aevum","Chongqing","Sector-12","New Tokyo","Ishima","Volhaven"];

function not_array_from(array, everything) {
	var not_array = [];
	for(var item of everything[Symbol.iterator]()) {
		if(!array.includes(item)) {
			not_array.push(item);
		}
	}
	return not_array;
}

class CorpData {
	static job_types = ["Operations", "Engineer", "Business", "Management", "Research & Development"];
	static research_order = [
		"Hi-Tech R&D Laboratory",
		"uPgrade: Fulcrum",
		"uPgrade: Dashboard",
		"uPgrade: Capacity.I",
		"uPgrade: Capacity.II",
		"Market-TA.I",
		"Market-TA.II",
		"Self-Correcting Assemblers",
		"Drones",
		"Drones - Assembly",
		"Drones - Transport",
		"Bulk Purchasing",
		"Automatic Drug Administration",
		"CPH4 Injections",
		"Go-Juice",
		"HRBuddy-Recruitment",
		"JoyWire",
		"Overclock",
		"Sti.mu",
		//"sudo.Assist",
		"AutoBrew",
		"AutoPartyManager",
		"HRBuddy-Training",
	];
	constructor(s) {
		this.s = s;
	}
	static testFunc(s, msg) {
		s.ns.tprint("msg = " + JSON.stringify(msg));
		const corp_consts = s.ns.corporation.getConstants();
		s.ns.tprint("Corporation Constants = " + JSON.stringify(corp_consts));
		s.ns.tprint("Industry types = " + corp_consts.industryNames.join(", "));
		s.ns.tprint("Material Names = " + corp_consts.materialNames.join(", "));
		s.ns.tprint("Research Names = " + corp_consts.researchNames.join(", "));
		s.ns.tprint("Unlockables = " + corp_consts.unlockNames.join(", "));
		s.ns.tprint("Upgrade Names = " + corp_consts.upgradeNames.join(", "));
		var corp = new CorpData(s);
		s.ns.tprint("Corporation = " + JSON.stringify(corp.corp));
		s.ns.tprint("CorpData divisionNames = " + JSON.stringify(corp.divisionNames));
		s.ns.tprint("CorpData hasOfficeAPI = " + corp.hasOfficeAPI);
		s.ns.tprint("CorpData hasWarehouseAPI = " + corp.hasOfficeAPI);
	}
	static async testPromptsFunc(s, msg) {
		var corp = new CorpData(s);
		const new_industry = await corp.chooseNewIndustry();
		s.ns.tprint("New Industry = " + JSON.stringify(new_industry));
	}
	static async testResearchFunc(s, msg) {
		var corp = new CorpData(s);
		if(corp.verifyOffice()) { return; }
		const division = await corp.chooseDivision();
		if(("" == division) || (undefined === division)) { return; }
		const div_data = s.ns.corporation.getDivision(division);
		const makesProducts = div_data.makesProducts;
		s.ns.tprint("Division = " + division);
		for(var name of CorpData.research_order[Symbol.iterator]()) {
			if(makesProducts || !name.startsWith('uPgrade')) {
				const cost = s.ns.corporation.getResearchCost(division, name);
				s.ns.tprint(name + " cost = " + cost);
				const has = s.ns.corporation.hasResearched(division, name);
				s.ns.tprint("Has " + name + " = " + has);
			}
		}
	}
	static async newCityFunc(s, msg) {
		var corp = new CorpData(s);
		if(corp.verifyOfficeWarehouse()) { return; }
		if(!corp.hasOfficeAPI || !corp.hasWarehouseAPI) {
			s.ns.tprint("You need both the Office and Warehouse APIs");
			return;
		}
		const division_and_city = await corp.chooseNewCityForDivision();
		const division = division_and_city[0];
		if("" == division) { return; }
		const new_cities = division_and_city[1];
		if(0 == new_cities.length) { return; }
		const needed_money = (s.ns.corporation.getExpandCityCost()
			+ s.ns.corporation.getPurchaseWarehouseCost()) * new_cities.length;
		const available_money = corp.corp.funds;
		if(available_money < needed_money) {
			s.ns.tprint("You need at least $" + fmt.notation(needed_money)
				+ " but only have $" + fmt.notation(available_money));
			return;
		}
		for(var new_city of new_cities[Symbol.iterator]()) {
			s.ns.corporation.expandCity(division, new_city);
			s.ns.corporation.purchaseWarehouse(division, new_city);
			CorpData.setupNewCity(s, division, new_city);
		}
		var new_size;
		while(undefined === new_size) {
			new_size = await s.ns.prompt("Enter desired office size:", { type: "text", });
			if(new_size < 3) {
				s.ns.tprint("The new size (" + new_size + ") can't be less than the current size (3)");
				s.ns.tprint("Setting size to 3");
				new_size = 3;
			}
			const add_size = new_size - 3;
			const size_cost = s.ns.corporation.getOfficeSizeUpgradeCost(division, new_cities[0], add_size) * new_cities.length;
			if(size_cost > corp.corp.funds) {
				s.ns.tprint("You need at least $" + fmt.notation(size_cost)
					+ " but only have $" + fmt.notation(available_money));
				new_size = undefined;
			}
		}
		for(var new_city of new_cities[Symbol.iterator]()) {
			await CorpData.setOfficeSize(s, division, new_city, new_size);
		}
	}
	static async newDivisionFunc(s, msg) {
		var corp = new CorpData(s);
		if(corp.verifyOfficeWarehouse()) { return; }
		const industry = await corp.chooseNewIndustry();
		if("" == industry) { return; }
		const industry_cost = s.ns.corporation.getExpandIndustryCost(industry);
		const available_money = corp.corp.funds;
		if(available_money < industry_cost) {
			s.ns.tprint("You need at least $" + fmt.notation(industry_cost)
				+ " but only have $" + fmt.notation(available_money));
			return;
		}
		const div_name = await s.ns.prompt("Enter division name for " + industry + ":", { type: "text", });
		s.ns.tprint("Division Name = " + div_name);
		s.ns.corporation.expandIndustry(industry, div_name);
		CorpData.setupNewCity(s, div_name, "Sector-12");
		await CorpData.setOfficeSize(s, div_name, "Sector-12");
	}
	static async newSizeFunc(s, msg) {
		var corp = new CorpData(s);
		if(corp.verifyOfficeWarehouse()) { return; }
		const division = await corp.chooseDivision();
		if("" == division) { return; }
		const cities = await corp.chooseDivisionCities(division);
		if(0 == cities.length) { return; }
		const new_size = await s.ns.prompt("Enter desired office size:", { type: "text", });
		for(var city of cities[Symbol.iterator]()) {
			CorpData.setupNewCity(s, division, city);
			await CorpData.setOfficeSize(s, division, city, new_size);
		}
	}
	static getJobsPrompt(size, old_jobs, new_jobs) {
		var job_prompt = "";
		var remain_old = size;
		var remain_new = size;
		for(var job of CorpData.job_types[Symbol.iterator]()) {
			job_prompt += fmt.align_left(job + ":", 25); 
			var old_count = old_jobs[job];
			remain_old -= old_count;
			job_prompt += fmt.align_right(old_count, 6);
			var new_count = new_jobs[job];
			if(undefined === new_count) { new_count = ""; }
			else { remain_new -= new_count; }
			job_prompt += fmt.align_right(new_count, 6) + "\n";
		}
		job_prompt += fmt.align_left("Available:", 25) + fmt.align_right(remain_old, 6) + fmt.align_right(remain_new, 6) + "\n";
		return job_prompt;
	}
	static async setEmployeesFunc(s, msg) {
		var corp = new CorpData(s);
		if(corp.verifyOfficeWarehouse()) { return; }
		const division = await corp.chooseDivision();
		if("" == division) { return; }
		const city = await corp.chooseDivisionCity(division);
		if("" == city) { return; }
		const office = s.ns.corporation.getOffice(division, city);
		var remain = office.size;
		var new_jobs = {};
		for(var job of CorpData.job_types[Symbol.iterator]()) {
			const job_prompt = CorpData.getJobsPrompt(office.size, office.employeeJobs, new_jobs);
			var new_count = Number.parseInt(await s.ns.prompt(job_prompt + "Enter employee count for "
				+ job + ":", { type: "text", }));
			if(Number.isNaN(new_count)) { new_count = 0; }
			new_jobs[job] = new_count;
			remain -= new_count;
			if(0 > remain) {
				s.ns.tprint("ERROR: Not enough employees for selected quantity")
			}
		}
		if(0 < office.employeeJobs.Training) {
			s.ns.corporation.setAutoJobAssignment(division, city, "Training", 0);
		}
		// Set sizes for jobs that are shrinking.
		for(var job of CorpData.job_types[Symbol.iterator]()) {
			if(office.employeeJobs[job] > new_jobs[job]) {
				s.ns.corporation.setAutoJobAssignment(division, city, job, new_jobs[job]);
			}
		}
		// Set sizes for jobs that are growing.
		for(var job of CorpData.job_types[Symbol.iterator]()) {
			if(office.employeeJobs[job] < new_jobs[job]) {
				s.ns.corporation.setAutoJobAssignment(division, city, job, new_jobs[job]);
			}
		}
		if(0 < remain) {
			s.ns.corporation.setAutoJobAssignment(division, city, "Training", remain);
		}
	}
	static viewSizesFunc(s, msg) {
		var corp = new CorpData(s);
		if(corp.verifyOffice()) { return; }
		s.ns.tprint("Division                        Aevum      Chongqing  Sector-12  New Tokyo  Ishima     Volhaven");
		s.ns.tprint("------------------------------  ---------  ---------  ---------  ---------  ---------  ---------");
		for(var div of corp.corp.divisions[Symbol.iterator]()) {
			var size_line = fmt.align_left(div.name, 30);
			var amounts = new Map();
			for(var city of div.cities[Symbol.iterator]()) {
				const office = s.ns.corporation.getOffice(div.name, city);
				amounts.set(city, office.size);
			}
			for(var city of ALL_CITIES[Symbol.iterator]()) {
				size_line += fmt.align_right(amounts.get(city), 11);
			}
			s.ns.tprint(size_line);
		}
	}
	static async setUpgradeLevelFunc(s, msg) {
		var corp = new CorpData(s);
		const upgrade = await corp.chooseLevelUpgrade();
		const target_level = await s.ns.prompt("Current level: " + s.ns.corporation.getUpgradeLevel(upgrade)
			+ "\nEnter target level:", { type: "text", });
		const cost_limit = corp.corp.funds / 1000;
		while((target_level > s.ns.corporation.getUpgradeLevel(upgrade))
			&& (cost_limit >= s.ns.corporation.getUpgradeLevelCost(upgrade)))
		{
			s.ns.corporation.levelUpgrade(upgrade);
		}
		s.ns.tprint("Upgrade " + upgrade + " leveled up to level " + s.ns.corporation.getUpgradeLevel(upgrade));
		if(target_level > s.ns.corporation.getUpgradeLevel(upgrade)) {
			s.ns.tprint("Level limited by upgrade cost");
			s.ns.tprint("Cost to level upgrade is " + fmt.notation(s.ns.corporation.getUpgradeLevelCost(upgrade)));
		}
	}
	static async setUpgradeCostFunc(s, msg) {
		var corp = new CorpData(s);
		const upgrade = await corp.chooseLevelUpgrade();
		var cost_limit = await s.ns.prompt("Corporation funds: " + fmt.notation(corp.corp.funds)
			+ "\nEnter level cost limit:", { type: "text", });
		if(cost_limit > corp.corp.funds) {
			s.ns.tprint("ERROR: Cost limit ($" + fmt.notation(cost_limit)
				+ ") set higher than corporation funds (" + fmt.notation(corp.corp.funds));
			return;
		}
		while(cost_limit >= s.ns.corporation.getUpgradeLevelCost(upgrade)) {
			s.ns.corporation.levelUpgrade(upgrade);
		}
		s.ns.tprint("Upgrade " + upgrade + " leveled up to level " + s.ns.corporation.getUpgradeLevel(upgrade));
		s.ns.tprint("Cost to level upgrade is " + fmt.notation(s.ns.corporation.getUpgradeLevelCost(upgrade)));
	}
	static async setOfficeSize(s, division, city, size) {
		var corp = new CorpData(s);
		const office = s.ns.corporation.getOffice(division, city);
		var error = "";
		var new_size = size;
		if(undefined === new_size) {
			new_size = await s.ns.prompt(error + "Enter desired office size (current size is " + office.size + "):", { type: "text", });
		}
		if(new_size < office.size) {
			new_size = office.size;
		}
		const add_size = new_size - office.size;
		const size_cost = s.ns.corporation.getOfficeSizeUpgradeCost(division, city, add_size);
		if(size_cost > corp.corp.funds) {
			s.ns.tprint("You need at least $" + fmt.notation(size_cost)
				+ " but only have $" + fmt.notation(available_money));
			return;
		}
		var update_office = true;
		if(0 < size_cost) {
			update_office = await s.ns.prompt("Expand " + city + " office from " + office.size
				+ " to " + new_size + " for $" + fmt.notation(size_cost) + "?", { type: "boolean", });
		}
		if(update_office) {
			if((0 < add_size) && (corp.corp.funds >= size_cost)) {
				s.ns.corporation.upgradeOfficeSize(division, city, add_size);
				await CorpData.assignEmployees(s, division, city);
			}
			else if(0 == add_size) {
				await CorpData.assignEmployees(s, division, city);
			}
		}
	}
	static assignEmployees(s, division, city) {
		var corp = new CorpData(s);
		const office = s.ns.corporation.getOffice(division, city);
		const office_size = office.size;
		const need_employees = office.size - office.employees.length;
		for(var i = 0; i < need_employees; i++) {
			s.ns.corporation.hireEmployee(division, city);
		}
		const quarter_base = Math.floor(office_size / 4);
		const quarter_rem = office_size % 4;
		const eighth_base = Math.floor(office_size / 8);
		const eighth_rem = office_size % 8;
		const needs_research = corp.needsResearch(division);
		var remain;
		var job_array;
		var rem_array;
		if(needs_research) {
			remain = office_size - (quarter_base * 3) - (eighth_base * 2);
			// Operations, Research & Development, Engineer, Management, Business
			job_array = [quarter_base, quarter_base, quarter_base, eighth_base, eighth_base];
			rem_array = [quarter_rem, quarter_rem, quarter_rem, eighth_rem, eighth_rem];
		}
		else {
			const half_base = Math.floor(office_size / 2);
			const half_rem = office_size % 2;
			remain = office_size - half_base - quarter_base - (eighth_base * 2);
			job_array = [half_base, 0, quarter_base, eighth_base, eighth_base];
			rem_array = [half_rem, 0, quarter_rem, eighth_rem, eighth_rem];
		}
		if(0 < remain) {
			var index = 0;
			while(((0 != job_array[index]) || (0 == rem_array[index])) && (5 > index)) {
				index += 1;
			}
			if(5 == index) { index = 0; }
			if(0 == index) {
				while(0 == rem_array[index]) {
					index += 1;
				}
			}
			while(0 < remain) {
				job_array[index] += 1;
				remain -= 1;
				index += 1;
				if(5 <= index) { index = 0; }
				while(0 == rem_array[index]) {
					index += 1;
					if(5 <= index) { index = 0; }
				}
			}
		}
		if(0 < office.employeeJobs.Training) {
			s.ns.corporation.setAutoJobAssignment(division, city, "Training", 0);
		}
		const new_jobs = {
			// Operations, Research & Development, Engineer, Management, Business
			Operations: job_array[0],
			"Research & Development": job_array[1],
			Engineer: job_array[2],
			Management: job_array[3],
			Business: job_array[4],
		};
		// Set sizes for jobs that are shrinking.
		for(var job of CorpData.job_types[Symbol.iterator]()) {
			if(office.employeeJobs[job] > new_jobs[job]) {
				s.ns.corporation.setAutoJobAssignment(division, city, job, new_jobs[job]);
			}
		}
		// Set sizes for jobs that are growing.
		for(var job of CorpData.job_types[Symbol.iterator]()) {
			if(office.employeeJobs[job] < new_jobs[job]) {
				s.ns.corporation.setAutoJobAssignment(division, city, job, new_jobs[job]);
			}
		}
	}
	static setupNewCity(s, division, city) {
		var corp = new CorpData(s);
		const div_data = corp.corp.divisions.find(div => div.name == division);
		//s.ns.tprint("Divisions Data = " + JSON.stringify(corp.corp.divisions));
		//s.ns.tprint("Division Data = " + JSON.stringify(div_data));
		const industry = div_data.type;
		switch(industry) {
			case 'Energy':
				s.ns.corporation.sellMaterial(division, city, 'Energy', 'MAX', 'MP');
				break;
			case 'Utilities':
				s.ns.corporation.sellMaterial(division, city, 'Water', 'MAX', 'MP');
				break;
			case 'Agriculture':
				s.ns.corporation.sellMaterial(division, city, 'Plants', 'MAX', 'MP');
			case 'Fishing':
				s.ns.corporation.sellMaterial(division, city, 'Food', 'MAX', 'MP');
				break;
			case 'Mining':
				s.ns.corporation.sellMaterial(division, city, 'Metal', 'MAX', 'MP');
			case 'Chemical':
				s.ns.corporation.sellMaterial(division, city, 'Chemicals', 'MAX', 'MP');
				break;
			case 'Pharmaceutical':
				s.ns.corporation.sellMaterial(division, city, 'Drugs', 'MAX', 'MP');
				break;
			case 'Robotics':
				s.ns.corporation.sellMaterial(division, city, 'Robots', 'MAX', 'MP');
				break;
			case 'Computer':
				s.ns.corporation.sellMaterial(division, city, 'Hardware', 'MAX', 'MP');
				break;
			case 'Software':
				s.ns.corporation.sellMaterial(division, city, 'AI Cores', 'MAX', 'MP');
				break;
			case 'RealEstate':
				s.ns.corporation.sellMaterial(division, city, 'Real Estate', 'MAX', 'MP');
			case 'Food':
			case 'Tobacco':
			case 'Healthcare':
				// Products only.
				break;
			default:
				s.ns.tprint("Unsupported industry: " + industry);
		}
	}
	static updateResearchTask(s, data) {
		var sleep_time = 120000;
		var corp = new CorpData(s);
		if(!corp.hasOfficeAPI) {
			s.addTask(function(s, data) { CorpData.updateResearchTask(s, data); }, data, sleep_time);
			return;
		}
		s.ns.tprint("updateResearchTask: corp.corp = " + JSON.stringify(corp.corp));
		for(var division of corp.corp.divisions[Symbol.iterator]()) {
			const corp_div = s.ns.corporation.getDivision(division);
			s.ns.tprint("updateResearchTask: division = " + division);
			s.ns.tprint("updateResearchTask: corp_div = " + JSON.stringify(corp_div));
			if(corp.needsResearch(division)) {
				var div_data = corp.getDivisionData(corp_div.name);
				var research_cost = div_data.next_research_cost;
				if(corp_div.research > research_cost) {
					const research_name = CorpData.research_order[div_data.next_research_index];
					notify(s, "Purchasing research " + research_name + " at the " + division + " division");
					s.ns.corporation.research(division, research_name);
					if(!corp.nextResearch(division)) {
						s.ns.tprint("Corporation Division = " + JSON.stringify(corp_div));
						s.ns.tprint("Cities = " + JSON.stringify(corp_div.cities));
						for(var city of corp_div.cities[Symbol.iterator]()) {
							CorpData.assignEmployees(s, division, city);
						}
					}
					sleep_time = 1000;
				}
				else if(100 > (research_cost - corp_div.research)) {
					s.ns.tprint("Shortening time because " + division + " is close to buying next research for "
						+ research_cost + " at " + corp_div.research);
					sleep_time = 30000;
				}
			}
		}
		s.addTask(function(s, data) { CorpData.updateResearchTask(s, data); }, data, sleep_time);
	}
	get corp() {
		if(undefined === this.corp_inner) {
			this.corp_inner =  this.s.ns.corporation.getCorporation();
		}
		return this.corp_inner;
	}
	needsResearch(division) {
		var division_data = this.getDivisionData(division);
		if(undefined === division_data) { return undefined; }
		var needs_research = division_data.needs_research;
		if(undefined === needs_research) {
			needs_research = this.nextResearch(division);
		}
		return needs_research;
	}
	nextResearch(division) {
		this.ns.tprint("nextResearch: division = " + division);
		var division_data = this.getDivisionData(division);
		const end_index = CorpData.research_order.length;
		var index = division_data.next_research_index;
		if(undefined === index) { index = 0; }
		while(index < end_index) {
			const name = CorpData.research_order[index];
			const makesProducts = this.s.ns.corporation.getDivision(division).makesProducts;
			if((makesProducts || !name.startsWith('uPgrade')) && !this.s.ns.corporation.hasResearched(division, name)) {
				division_data.next_research_index = index;
				division_data.next_research_cost = this.s.ns.corporation.getResearchCost(division, name);
				division_data.needs_research = true;
				this.s.ns.tprint("Updating division data to " + JSON.stringify(division_data));
				return true;
			}
			else {
				index += 1;
			}
		}
		division_data.next_research_index = undefined;
		division_data.next_research_cost = undefined;
		division_data.needs_research = false;
		this.s.ns.tprint("Updating division data to " + JSON.stringify(division_data));
		return false;
	}
	getDivisionData(division) {
		var division_data_array = this.s.task.division_data_array;
		if(undefined === division_data_array) {
			this.s.task.division_data_array = [];
			for(var corp_div of this.corp.divisions[Symbol.iterator]()) {
				this.s.task.division_data_array.push({
					name: corp_div.name,
				});
			}
			division_data_array = this.s.task.division_data_array;
		}
		var division_data = division_data_array.find(div_obj => div_obj.name == division);
		if(undefined === division_data) {
			const corp_div = this.corp.divisions.find(div_obj => div_obj.name == division);
			if(undefined === corp_div) { return undefined; }
			division_data_array.push({
				name: corp_div.name,
			});
			division_data = division_data_array.find(div_obj => div_obj.name == division);
		}
		return division_data;
	}
	get divisionNames() {
		var names = [];
		for(var division of this.corp.divisions[Symbol.iterator]()) {
			names.push(division.name);
		}
		return names;
	}
	get divisionTypes() {
		var types = [];
		for(var division of this.corp.divisions[Symbol.iterator]()) {
			types.push(division.type);
		}
		return types;
	}
	async chooseDivision() {
		if(0 == this.divisionNames.length) {
			return "";
		}
		else if(1 == this.divisionNames.length) {
			return this.divisionNames[0];
		}
		return await this.s.ns.prompt("Choose Division:", { type: "select", choices: this.divisionNames, });
	}
	async chooseDivisionCity(division) {
		const division_data = this.corp.divisions.find(div => div.name == division);
		if((undefined === division_data) || (0 == division_data.cities.length)) { return ""; }
		if(1 == division_data.cities.length) { return division_data.cities[0]; }
		return await this.s.ns.prompt("Choose City for " + division + ":", { type: "select", choices: division_data.cities, });
	}
	async chooseDivisionCities(division) {
		const division_data = this.corp.divisions.find(div => div.name == division);
		if((undefined === division_data) || (0 == division_data.cities.length)) { return []; }
		if(1 == division_data.cities.length) { return [division_data.cities[0]]; }
		//return await this.s.ns.prompt("Choose City for " + division + ":", { type: "select", choices: division_data.cities, });
		var cities = division_data.cities.concat(["All"]);
		const choice = await this.s.ns.prompt("Choose City for " + division + ":", { type: "select", choices: cities, });
		if("All" == choice) {
			cities.pop();
			return cities;
		}
		else {
			return [choice];
		}
	}
	async chooseNewCityForDivision() {
		var names = [];
		for(var division of this.corp.divisions[Symbol.iterator]()) {
			if(6 > division.cities.length) {
				names.push(division.name);
			}
		}
		if(0 == names.length) { return ["", []]; }
		var new_division;
		if(1 == names.length) {
			new_division = names[0];
		}
		else {
			new_division = await this.s.ns.prompt("Choose Division:", { type: "select", choices: names, });
		}
		if("" == new_division) { return ["", []]; }
		var division_data = this.corp.divisions.find(div => div.name == new_division);
		if(undefined === division_data) { return ["", []]; }
		const new_cities = not_array_from(division_data.cities, ALL_CITIES);
		if(0 == new_cities.length) {
			return ["", []];
		}
		else if(1 == new_cities.length) {
			return [new_division, [new_cities[0]]];
		}
		new_cities.push("All");
		const choice = await this.s.ns.prompt("Choose City for " + new_division + ":", { type: "select", choices: new_cities, });
		if("All" == choice) {
			new_cities.pop();
			return [new_division, new_cities];
		}
		else {
			return [new_division, [choice]];
		}
	}
	async chooseNewIndustry() {
		var industry_types = this.s.ns.corporation.getConstants().industryNames;
		// For some reason, the non-industry type "Hardware" is returned by getIndustryTypes() instead of "Computer".
		const computer_index = industry_types.findIndex(v => v == "Hardware");
		industry_types.splice(computer_index, 1, "Computer")
		var new_industries = not_array_from(this.divisionTypes, industry_types);
		if(0 == new_industries.length) { return ""; }
		var choices = [];
		for(var industry of new_industries[Symbol.iterator]()) {
			const cost = this.s.ns.corporation.getExpandIndustryCost(industry);
			choices.push(industry + " (" + fmt.notation(cost) + ")");
		}
		var choice = await this.s.ns.prompt("Choose Industry for new division:", { type: "select", choices: choices, });
		const end_index = choice.indexOf(" (");
		return choice.substring(0, end_index);
	}
	async chooseLevelUpgrade() {
		const choices = this.s.ns.corporation.getUpgradeNames();
		return await this.s.ns.prompt("Choose Leveled Upgrade:", { type: "select", choices: choices, });
	}
	verifyOffice() {
		if(this.hasOfficeAPI) { return false; }
		s.ns.tprint("You need the Office API");
		return true;
	}
	verifyWarehouse() {
		if(this.hasWarehouseAPI) { return false; }
		s.ns.tprint("You need the Warehouse API");
		return true;
	}
	verifyOfficeWarehouse() {
		if(this.hasOfficeAPI && this.hasWarehouseAPI) { return false; }
		s.ns.tprint("You need both the Office and Warehouse APIs");
		return true;
	}
	get hasOfficeAPI() {
		return this.s.ns.corporation.hasUnlock("Office API");
	}
	get hasWarehouseAPI() {
		return this.s.ns.corporation.hasUnlock("Warehouse API");
	}
}

class OfficeExtension {
	constructor(s) {
		this.s = s;
	}
}

class WarehouseExtension {
	constructor(s) {
		this.s = s;
	}
}
