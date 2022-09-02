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

export function commafy(s) {
	var parts = String(s).split(".", 2);
	var decimal = "";
	if(2 == parts.length) {
		decimal = "." + parts.pop();
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
