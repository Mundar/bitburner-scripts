/** @param {NS} ns */
export function align_right(s, w) {
	const spaces = w - String(s).length;
	var tab = "";
	for(var i = 0; spaces > i; ++i) {
		tab += " ";
	}
	return tab + s;
}

export function align_left(s, w) {
	const spaces = w - String(s).length;
	var tab = "";
	for(var i = 0; spaces > i; ++i) {
		tab += " ";
	}
	return s + tab;
}

export function notation(value) {
	const letters = [" ", "k", "m", "b", "t", "q", "Q", "s", "S", "o", "n", "d", "u", "D", "T", "qd", "Qd", "sd", "Sd", "O", "N", "v"];
	var index = 0;
	while(value >= 1000) {
		index += 1;
		value /= 1000;
	}
	var parts = String(value).split(".", 2);
	if(1 == parts.length) { parts.push("000"); }
	while(parts[1].length < 3) {
		parts[1] += "0";
	}
	parts[1] = parts[1].substring(0,3);
	var letter;
	if(index < letters.length) {
		letter = letters[index];
	}
	else {
		letter = "e" + (index * 3);
	}
	return parts.join('.') + letter;
}

export function commafy(s, d) {
	var parts = String(s).split(".", 2);
	var decimal = "";
	if(2 == parts.length) {
		decimal = "." + parts.pop();
		if(undefined !== d) {
			if(0 != d) {
				decimal = decimal.substring(0, d+1);
			}
			else {
				decimal = "";
			}
		}
	}
	var temp = Array.from(parts[0]);
	var count = 0;
	var commafied_string = [];
	while(0 < temp.length) {
		const letter = temp.pop();
		commafied_string.push(letter);
		if((2 == count) && (0 < temp.length)) {
			commafied_string.push(',');
			count = 0;
		}
		else {
			count++;
		}
	}
	return commafied_string.reverse().join('') + decimal;
}

export function decimal(s, d) {
	var parts = String(s).split(".", 2);
	var decimal = "";
	if(2 == parts.length) {
		decimal = "." + parts.pop();
		if(undefined !== d) {
			if(0 != d) {
				decimal = decimal.substring(0, d+1);
			}
			else {
				decimal = "";
			}
		}
	}
	return parts[0] + decimal;
}

export function fixed(s, d) {
	var parts = String(s).split(".", 2);
	if(1 == parts.length) { parts.push("0"); }
	while(parts[1].length < d) {
		parts[1] += "0";
	}
	parts[1] = parts[1].substring(0,d);
	return parts.join('.');
}

export function time(ms) {
	const time = Math.round(ms);
	const millis = time % 1000;
	const seconds = Math.floor(time / 1000) % 60;
	if(60000 > time) { return seconds + "." + leading_zeros(millis, 3); }
	const minutes = Math.floor(time / 60000) % 60;
	if(3600000 > time) { return minutes + ":" + leading_zeros(seconds, 2) + "." + leading_zeros(millis, 3); }
	const hours = Math.floor(time / 3600000);
	return hours + ":" + leading_zeros(minutes, 2) + ":" + leading_zeros(seconds, 2) + "." + leading_zeros(millis, 3);
}

export function leading_zeros(s, w) {
	const spaces = w - String(s).length;
	var tab = "";
	for(var i = 0; spaces > i; ++i) {
		tab += "0";
	}
	return tab + s;
}

// Support reading '1PB', '512TB', '128GB', and parse into the value.
export function textToGB(text) {
	if(String(text).endsWith('B')) {
		var parts = String(text).split('');
		parts.pop(); // B
		const mult_char = parts.pop();
		var value = parseInt(parts.join(''));
		if('P' == mult_char) {
			value *= 1024*1024;
		}
		else if('E' == mult_char) {
			value *= 1024*1024*1024;
		}
		else if('T' == mult_char) {
			value *= 1024;
		}
		return value;
	}
	else {
		return parseInt(text);
	}
}
