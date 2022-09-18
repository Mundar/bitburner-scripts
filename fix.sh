#!/bin/bash
echo "Copying files to root..."
for FILE in grow.js hack-exp.js hack.js hack1.js mcp-remote.js mcp-single.js weaken.js; do
	if [[ -f $FILE ]]; then
		mv $FILE root/$FILE
	fi
done
echo "Adding newlines to end of javascript files..."
# FILES=`ls bin/*.js include/*.js include/mcp/*.js rpc/*.js rpc/idle/*.js root/*.js`
FILES=`find . -name "*.js" -print`
for FILE in $FILES; do
	if git diff $FILE | grep -q "\\ No newline at end of file"; then
		echo "" >> $FILE
	fi
done
echo "Deleting text files..."
for FILE in host-details.txt locations.txt other-servers.txt readme.txt; do
	if [[ -f $FILE ]]; then
		rm $FILE
	fi
done
