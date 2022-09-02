# bitburner-scripts
These are scripts to automate playing the game Bitburner

I discovered this game recently on Steam and have been enjoying it for the last
few days. You can also play it by visiting
https://danielyxie.github.io/bitburner/.

I am currently creating a program I have named the MCP to automate as much as I
can, and it is starting to get complicated enough that I wanted to use version
control on my scripts. While there is no way to access the file directly from
the game, it does support copying files directly from GitHub. so that is the
tact I am taking.

# Installation
The easiest way to get started would be to paste the following command at the
terminal of the game:

```
wget "https://raw.githubusercontent.com/mundar/bitburner-scripts/master/bin/get-update-script.js" "get-update-script.js"
```

and then:

```
run get-update-script.js
run update.js
```

# Usage
Start the MCP by running the script from 'bin/mcp.js'. You interact with the MCP by sending messages using `bin/send.js`.

# Messages
```
run bin/send.js help
```
