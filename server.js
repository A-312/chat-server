var crypto = require("crypto"),
	extend = require('util')._extend;

module.exports = {
	clients: [],
	keys: {},
	rangs: ["Invité"],
	changes: [],
	messages: {},
	lastIndex: 0,
	Chat: null,
	guest: 0,
	//express
	serverHTTP: null,
	app: null,
	//socketio
	IO: null,
	load: function() {},
	port: (process.platform == "linux") ? 1080 : 5000,
	exit: function() {
		console.log("Arrêt du serveur dans 4 secondes.");
		module.exports.emitToClients("waitme");
		module.exports.sendMessage("Serveur", "Arrêt programmé du serveur dans 4 secondes.");

		setTimeout(function() {
			process.exit(1);
		}, 4000);
	},
	uncaughtException: function(err) {
		console.warn("\033[91m/!\\ " + err + "\033[00m");
		console.warn(err.stack);
		module.exports.emitToClients("crash");
		process.exit(1);
	},
	emitToClients: function(name, argument) {
		if (this.clients.length === 0) return;

		for (var i in this.clients) {
			this.Chat.connected[this.clients[i].idSocket].emit(name, argument);
		}
	},
	emitToClient: function(id, name, argument) {
		if (typeof(this.clients[id]) == "undefined") return;

		this.Chat.connected[this.clients[id].idSocket].emit(name, argument);
	},
	emitToOtherClients: function(id, name, argument) {
		if (this.clients.length === 0) return;

		for (var i in this.clients) {
			if (i != id) {
				this.Chat.connected[this.clients[i].idSocket].emit(name, argument);
			}
		}
	},
	runChatCmd: function(Socket, text) {
		var ip = Socket.request.connection.remoteAddress || Socket.client.conn.remoteAddress;

		if (text === "/ping") {
			Socket.emit("ping", {
				timestamp: +new Date()
			});
			return true;
		}

		if (text === "/private") {
			Socket.data.nolog = !Socket.data.nolog;

			Socket.emit("info", {
				msg: "Vos message seront " + (!Socket.data.nolog ? "visible" : "invisible") + " dans les logs.",
				wait: 12000
			});
			return true;
		}

		if (text === "/crash" && (ip === "127.0.0.1" || ip === "82.237.0.146")) {
			null[0].lol[0];
			return true;
		}

		var abc = "/changelog ";
		if (text.indexOf(abc) === 0 && ip === "::ffff:127.0.0.1") {
			text = text.substr(abc.length).replace(/\s/g, " ");

			module.exports.sendMessage("Information", module.exports.changes.length + ": " + text);
			module.exports.changes.push(text);

			require("fs").writeFile("CHANGELOG", module.exports.changes.join("\n"));

			return true;
		} else {
			console.log(ip);
		}

		if (text === "/reload" && (ip === "::ffff:127.0.0.1" || ip === "82.237.0.146")) {
			console.log("Reload.");
			module.exports.emitToOtherClients(Socket.data.idClient, "reload");
			return true;
		}

		return false;
	},
	getClientList: function() {
		var list = [];
		for (var i in module.exports.clients) {
			list.push(module.exports.clients[i].pseudo);
		}
		return list.join(",");
	},
	editMessage: function(num, text, send, Socket) {
		var message = module.exports.messages[num],
			nolog = Socket && Socket.data.nolog;

		message.text = (!nolog) ? text : "[nolog: ?]";
		message.edition = true;

		var msg = {
			text: text,
			edit: "#" + num.toString(16),
			nolog: !!nolog
		};

		if (!send && send !== false) {
			this.emitToClients("message", msg);
		}

		return msg;
	},
	sendMessage: function(pseudo, text, send, Socket) {
		var msg = {
			pseudo: pseudo,
			text: text,
			time: +new Date(),
			hex: "#" + this.lastIndex.toString(16)
		};

		module.exports.messages[this.lastIndex] = extend({}, msg);

		if (Socket && Socket.data.nolog) {
			module.exports.messages[this.lastIndex].text = "[nolog: ?]";
			msg.nolog = true;
		}

		this.lastIndex++;

		if (!send && send !== false) {
			this.emitToClients("message", msg);
		}

		return msg;
	},
	infoConnexion: function(pseudo, connect, info) {
		var list = module.exports.getClientList(),
			meta = " @meta: list:[" + list + "] ";
		//meta = (list) ? meta : ""; ne pas rajouter.
		if (connect) {
			module.exports.sendMessage("Information", pseudo + " a rejoint le chat " + info + "." + meta);
		} else {
			module.exports.sendMessage("Information", pseudo + " a quitté le chat." + meta);
		}
	},
	sha256: function(text) {
		return crypto.createHash("sha256").update(text).digest("hex");
	},
	getRandomKey: function() {
		return this.sha256(crypto.randomBytes(32));
	}
};