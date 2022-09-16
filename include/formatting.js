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
		else if('T' == mult_char) {
			value *= 1024;
		}
		return value;
	}
	else {
		return parseInt(text);
	}
}
