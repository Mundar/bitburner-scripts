/** @param {NS} ns */
import {Service} from "/include/server.js";
import * as fmt from "/include/formatting.js";

export async function main(ns) {
	ns.disableLog("sleep");
	ns.disableLog("getServerMoneyAvailable");
	var service = new Service(ns);

	service.addCommand("status", function(s, msg) { status(s, msg); });
	service.addTask(buy_sell_shares_func(), {});

	await service.start();

	await service.exit();
}

function buy_sell_shares_func() {
	return function(s, data) { buy_sell_shares(s, data); }
}

const max_issued_shares = 950000000;

function buy_sell_shares(s, data) {
	var corporation = s.ns.corporation.getCorporation();
	const owned_shares = corporation.numShares;
	const issued_shares = corporation.issuedShares;
	const share_price = corporation.sharePrice;
	var sleep_time = 60000;
	if(0 == issued_shares) {
		// We bought all shares back and set dividend to 5% to raise the stock price.
		const cooldown = corporation.shareSaleCooldown;
		if(cooldown > 0) {
			sleep_time = (cooldown * 200);
			s.ns.toast("Sleeping for " + s.ns.tFormat(sleep_time) + " waiting for sell cooldown.", "info", 20000);
		}
		else {
			s.ns.toast("Time to sell 1,000,000 shares to raise price", "info", 20000);
			const price_before = share_price;
			const before_money = s.ns.getServerMoneyAvailable("home");
			s.ns.corporation.sellShares(1000000);
			const after_money = s.ns.getServerMoneyAvailable("home");
			 const price_after = s.ns.corporation.getCorporation().sharePrice;
			s.ns.print("Sold 1,000,000 shares at $" + fmt.decimal(price_before, 3) + " for a total of $" + fmt.notation(after_money - before_money));
			s.ns.print("Share price changed from $" + fmt.decimal(price_before, 3) + " to $" + fmt.decimal(price_after, 3));
		}
	}
	else if(owned_shares > issued_shares) {
		s.task.min_share_price = undefined;
		if(undefined === s.task.max_share_price) {
			s.ns.toast("Initial share price is $" + fmt.decimal(share_price, 3), "info", 10000);
			s.task.max_share_price = share_price;
			s.task.not_higher_count = 0;
		}
		else if(share_price > s.task.max_share_price) {
			s.ns.toast("Share price raised to $" + fmt.decimal(share_price, 3), "info", 10000);
			s.task.max_share_price = share_price;
			s.task.not_higher_count = 0;
		}
		else {
			if(30 > s.task.not_higher_count) {
				s.ns.toast("Share price below highest seen (" + fmt.decimal(share_price, 3) + " < " + fmt.decimal(s.task.max_share_price, 3) + ") " + s.task.not_higher_count + " times.", "info", 10000);
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
					s.ns.toast("Sleeping for " + s.ns.tFormat(sleep_time) + " waiting for sell cooldown.", "info", 20000);
				}
				else {
					const price_before = share_price;
					const before_money = s.ns.getServerMoneyAvailable("home");
					s.ns.corporation.sellShares(max_issued_shares - issued_shares);
					const after_money = s.ns.getServerMoneyAvailable("home");
					const price_after = s.ns.corporation.getCorporation().sharePrice;
					s.ns.print("Sold " + fmt.commafy(max_issued_shares - issued_shares, 0) + " shares at $" + fmt.decimal(price_before, 3) + " for a total of $" + fmt.notation(after_money - before_money));
					s.ns.print("Share price changed from $" + price_before + " to $" + price_after);
					s.ns.corporation.issueDividends(0.90);
				}
			}
		}
	}
	else {
		s.task.max_share_price = undefined;
		if(undefined === s.task.min_share_price) {
			s.ns.toast("Initial share price is $" + fmt.decimal(share_price, 3), "info", 10000);
			s.task.min_share_price = share_price;
			s.task.not_lower_count = 0;
		}
		else if(share_price < s.task.min_share_price) {
			s.ns.toast("Share price dropped to $" + fmt.decimal(share_price, 3), "info", 10000);
			s.task.min_share_price = share_price;
			s.task.not_lower_count = 0;
		}
		else {
			if(30 > s.task.not_lower_count) {
				s.ns.toast("Share price above lowest seen ($" + fmt.decimal(share_price, 3) + " > $" + fmt.decimal(s.task.min_share_price, 3) + ") " + s.task.not_lower_count + " times.", "info", 10000);
				s.task.not_lower_count += 1;
				sleep_time = 10000;
			}
			else {
				s.ns.toast("Time to buy all shares and set dividends to 5% to start raising share price", "info", 20000);
				const before_money = s.ns.getServerMoneyAvailable("home");
				s.ns.corporation.buyBackShares(issued_shares);
				const after_money = s.ns.getServerMoneyAvailable("home");
				s.ns.print("Bought back " + fmt.commafy(issued_shares, 0) + " shares at $" + fmt.decimal(share_price, 3) + " for a total of $" + fmt.notation(before_money - after_money));
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
