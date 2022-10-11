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
	service.addCommand("notify-mode", function(s, msg) { notify_mode_command(s, msg); });
	service.addTask(buy_sell_shares_func(), {});

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

function get_sell_mode(service) {
	if(undefined === service.task.sell_mode) {
		service.task.sell_mode = "none";
	}
	return service.task.sell_mode;
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
	if(undefined === new_mode) {
		s.ns.tprint("Current share sell mode = " + sell_mode_string(get_sell_mode(s)));
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
			case "deprecated":
				s.ns.tprint("Setting sell mode to " + sell_mode_string(new_mode)); 
				break;
			default:
				s.ns.tprint("Unsuported sell mode: \"" + new_mode + "\"");
				return;
		}
		s.task.sell_mode = new_mode;
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
	const sell_mode = get_sell_mode(s);
	var sleep_time = 60000;
	if((0 == issued_shares) && ("deprecated" == sell_mode)) {
		// We bought all shares back and set dividend to 5% to raise the stock price.
		const cooldown = corporation.shareSaleCooldown;
		if(cooldown > 0) {
			sleep_time = (cooldown * 200);
			notify(s, "Sleeping for " + s.ns.tFormat(sleep_time) + " waiting for sell cooldown.", "info", 20000);
		}
		else {
			notify(s, "Time to sell 1,000,000 shares to raise price", "info", 20000);
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
			notify(s, "Current share price is $" + fmt.notation(share_price), "info", 10000);
		}
		else if(normal_sell && (undefined === s.task.max_share_price)) {
			notify(s, "Initial share price is $" + fmt.notation(share_price), "info", 10000);
			s.task.max_share_price = share_price;
			s.task.not_higher_count = 0;
		}
		else if(normal_sell && (share_price > s.task.max_share_price)) {
			notify(s, "Share price raised to $" + fmt.notation(share_price), "info", 10000);
			s.task.max_share_price = share_price;
			s.task.not_higher_count = 0;
		}
		else {
			if(normal_sell && (sell.limit_count > s.task.not_higher_count)) {
				notify(s, "Share price below highest seen (" + fmt.notation(share_price) + " < " + fmt.notation(s.task.max_share_price) + ") " + s.task.not_higher_count + " times.", "info", 10000);
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
					notify(s, "Sleeping for " + s.ns.tFormat(sleep_time) + " waiting for sell cooldown.", "info", 20000);
				}
				else {
					const price_before = share_price;
					const before_money = s.ns.getServerMoneyAvailable("home");
					const shares_to_sell = sell.shares - issued_shares;
					notify(s, "Selling " + shares_to_sell + " shares");
					s.ns.corporation.sellShares(shares_to_sell);
					const after_money = s.ns.getServerMoneyAvailable("home");
					const price_after = s.ns.corporation.getCorporation().sharePrice;
					s.ns.print("Sold " + fmt.commafy(sell.shares - issued_shares, 0) + " shares at $" + fmt.notation(price_before) + " for a total of $" + fmt.notation(after_money - before_money));
					s.ns.print("Share price changed from $" + fmt.notation(price_before) + " to $" + fmt.notation(price_after));
					s.ns.print("Time since last augmentation installation is " + s.ns.tFormat(s.ns.getTimeSinceLastAug()));
					switch(get_sell_mode(s)) {
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
			notify(s, "Share price dropped to $" + fmt.notation(share_price));
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
				notify(s, "Buy all shares and set dividends to 5% to start raising share price");
				const before_money = s.ns.getServerMoneyAvailable("home");
				s.ns.corporation.buyBackShares(issued_shares);
				const after_money = s.ns.getServerMoneyAvailable("home");
				s.ns.print("Bought back " + fmt.commafy(issued_shares, 0) + " shares at $" + fmt.notation(share_price) + " for a total of $" + fmt.notation(before_money - after_money));
				s.ns.print("Time since last augmentation installation is " + s.ns.tFormat(s.ns.getTimeSinceLastAug()));
				s.ns.corporation.issueDividends(0.05);
			}
		}
	}
	s.addTask(buy_sell_shares_func(), data, sleep_time);
}

function status(s, msg) {
	const corporation = s.ns.corporation.getCorporation();
	s.ns.tprint("Name = " + corporation.name);
	s.ns.tprint("Owned shares = " + corporation.numShares);
	s.ns.tprint("Issued shares = " + corporation.issuedShares);
	s.ns.tprint("Share price = " + corporation.sharePrice);
	s.ns.tprint("Dividend rate = " + corporation.dividendRate);
	s.ns.tprint("Sale cooldown = " + s.ns.tFormat(corporation.shareSaleCooldown * 200));
}

class SellOptions {
	static default_shares = 950000000;
	static default_limit_count = 6;
	constructor(s) {
		this.s = s;
	}
	get shares() {
		if(undefined === this.s.task.sell_shares) { this.s.task.sell_shares = SellOptions.default_shares; }
		return this.s.task.sell_shares;
	}
	set shares(new_shares) {
		this.s.task.sell_shares = new_shares;
	}
	static sell_shares_command_func() {
		return function (s, msg) { SellOptions.sell_shares_command(s, msg); };
	}
	static sell_shares_command(s, msg) {
		const corporation = s.ns.corporation.getCorporation();
		const max_shares = corporation.numShares + corporation.issuedShares;
		const half_shares = Math.ceil(max_shares / 2) + 1
		const new_shares = Number.parseInt(msg.rest.shift());
		if(new_shares < half_shares) {
			return;
		}
		else if(new_shares > max_shares) {
			return;
		}
		s.task.num_shares = new_shares;
	}
	get limit_count() {
		if(undefined === this.s.task.sell_limit_count) { this.s.task.sell_limit_count = SellOptions.default_limit_count; }
		return this.s.task.sell_limit_count;
	}
}
