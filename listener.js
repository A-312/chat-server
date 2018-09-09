var Server = require("./server.js");

module.exports = {
	sendAllClientsInfo: function(idClient) {
		var tab = [];
		for (var i in Server.clients) {
			tab[i] = this.sendClientInfo(i);
		}
		Server.emitToClient(idClient, "client", {
			type: "all",
			clients: tab
		});
	},
	sendClientInfo: function(idClient) {
		var client = Server.clients[idClient];
		return {
			idClient: client.idClient,
			pseudo: client.pseudo,
			rang: client.pseudo
		};
	},
	deconnection: function(idClient) {
		var pseudo = Server.clients[idClient].pseudo;

		delete Server.clients[idClient];

		console.log(pseudo + " vient de se déconnecter.");
		Server.emitToOtherClients(idClient, "client", {
			type: "del",
			client: {
				idClient: idClient
			}
		});

		Server.infoConnexion(pseudo, false);
	},
	byebye: function(Socket) {
		Socket.disconnect();
		Socket.emit("byebye");
	},
	listener: function(Socket) {
		if (Socket.request.headers["origin"] && Socket.request.headers["origin"].indexOf(".12z.fr") === -1) {
			console.log("bad origin");
			return module.exports.byebye(Socket);
		}

		Server.guest++;
		console.log("[" + Socket.request.connection.remoteAddress + "] Début de la visite. " + Socket.id);

		Socket.on("disconnect", function() {
			Server.guest--;
			console.log("[" + Socket.request.connection.remoteAddress + "] Fin de la visite. " + Socket.id);
			if (!Socket.data) {
				return module.exports.byebye(Socket);
			}

			module.exports.byebye(Socket);
			module.exports.deconnection(Socket.data.idClient);
		});

		Socket.on("request", function() {
			console.log(arguments);
		});

		Socket.on("message", function(data, fn) {
			if (!Socket.data) {
				return fn({
					type: "erreur",
					msg: "Vous n'êtes plus connecté, actualisez !"
				});
			}

			var now = Math.round((new Date()).getTime() / 1000);

			if (!Socket.data.antiflood || Socket.data.antiflood[1] <= now) {
				Socket.data.antiflood = [0, 5 + now];
			}

			var nombre = Socket.data.antiflood[0] ++;

			if (4 <= nombre) {
				if (nombre < 12) {
					Socket.data.antiflood = [12, 20 + now];
				} else if (nombre == 19) {
					Socket.data.antiflood = [20, 45 + now];
				} else if (24 < nombre) {
					console.log("ANTI-FLOOD>> " + Socket.data.pseudo + " a été déconnecté.");
					fn({
						type: "erreur",
						msg: "Vous avez été quitté ! Trop de message."
					});
					return Socket.disconnect();
				}

				var sec = Socket.data.antiflood[1] - now;

				return fn({
					type: "erreur",
					msg: "Vous devez attendre " + sec + " secondes pour envoyer à nouveau des messages.",
					antiflood: sec
				});
			}

			var regex = /^([\W\w]{1,365})$/;
			if (data.text && regex.test(data.text)) {
				if (data.edit) {
					var error = function(text) {
						return fn({
							type: "erreur",
							msg: text,
							edit: true
						});
					};

					if (!/^#(.*)$/.test(data.edit))
						return error("Le numéro ne correspond pas.");

					var num = parseInt(/^#(.*)$/.exec(data.edit)[1], 16);

					if (isNaN(num) || !Server.messages[num])
						return error("Le message n'existe plus.");

					if (Server.messages[num].pseudo !== Socket.data.pseudo)
						return error("Ce n'est pas votre message !");

					if (num < Socket.data.connIndex || 240000 < (Server.messages[num].time - new Date()))
						return error("Vous ne pouvez plus éditer ce message.");

					if (Server.messages[num].text === data.text)
						return error("Rien à faire.");

					msg = Server.editMessage(num, data.text, false, Socket);
				} else {
					if (data.text[0] === "/") {
						if (Server.runChatCmd(Socket, data.text)) {
							return fn({
								type: "ok"
							});
						}
					}

					msg = Server.sendMessage(Socket.data.pseudo, data.text, false, Socket);
				}

				fn(msg); // Toujours laisser pour que l'input se reactive

				Server.emitToOtherClients(Socket.data.idClient, "message", msg);
			} else {
				fn({
					type: "erreur",
					msg: "Message trop court ou trop long. [S*]"
				});
			}
		});

		Socket.on("ping", function(data, fn) {
			if (!Socket.data) return;

			if (data && data.timestamp) {
				fn({
					timestamp: data.timestamp
				});
			}
		});

		Socket.on("pong", function(data) {
			if (typeof data.timestamp === "number") {
				var ms = (new Date() - data.timestamp) / 2;
				console.log(Socket.data.pseudo + " ping de " + ms + " ms.");
				Socket.emit("info", {
					msg: "ping : " + ms + " ms"
				});
			}
		});

		Socket.on("getPrevMessage", function(data, fn) {
			var currentIndex = data.currentIndex,
				data = {};

			if (typeof currentIndex === "number" && currentIndex <= Server.lastIndex) {
				data.messages = [];
				data.last = Math.max(0, currentIndex - 20);
				for (var i = currentIndex - 1; i >= data.last; i--) {
					data.messages.push(Server.messages[i]);
				}
			}

			fn(data);
		});

		Socket.on("login", function(data, fn) {
			if (Socket.data) return;

			var err = function(msg) {
				return fn({
					type: "erreur",
					msg: msg
				});
			};

			if (!data || !data.pseudo) {
				return err("Pseudo manquant.");
			}

			var regex = /^([A-z0-9\-_]{3,12})$/,
				regex2 = /^(Information|Serveu?r|Admin|Modo|Mod(é|e)rateur).*$/i;
			if (!regex.test(data.pseudo)) {
				return err("Le pseudo doit contenir uniquement : A-z, 0-9, -, _. Et faire entre 3 à 12 caractères. [S*]");
			} else if (regex2.test(data.pseudo)) {
				return err("Espace de nom réservé. [S*]");
			}

			for (var i in Server.clients) {
				if (Server.clients[i].pseudo == data.pseudo) {
					if (data.key && Server.keys[data.key] && Server.keys[data.key].indexOf(data.pseudo) !== -1) {
						Socket.emit("refuse", {
							type: "already_connected",
							refuse: "Vous êtes déjà dans ce salon."
						});
						return;
					}
					return err("Pseudo déjà utilisé.");
				}
			}

			var pseudo = data.pseudo,
				idClient = 0,
				rang = 0,
				young = (!data.key) ? true : false,
				key = data.key,
				text = null;

			while (typeof Server.clients[idClient] !== "undefined") {
				idClient++;
			}

			if (!key || !Server.keys[data.key]) {
				young = true;
				do {
					key = Server.getRandomKey()
				} while (typeof Server.keys[key] !== "undefined");

				Server.keys[key] = [pseudo];
			} else if (Server.keys[key].indexOf(pseudo) === -1) {
				Server.keys[key].push(pseudo);
			}

			text = (young) ? "Nouveau" : "[" + Server.keys[key].join(", ") + "]";

			Server.clients[idClient] = Socket.data = {
				idClient: idClient,
				idSocket: Socket.id,
				connIndex: Server.lastIndex,
				pseudo: pseudo,
				rang: 0,
				key: key
			};

			fn({
				type: "parfait",
				idClient: idClient,
				currentIndex: Server.lastIndex,
				pseudo: pseudo,
				key: key
			});

			Server.emitToOtherClients(idClient, "client", {
				type: "add",
				client: module.exports.sendClientInfo(idClient)
			});
			module.exports.sendAllClientsInfo(idClient);

			Server.infoConnexion(pseudo, true, "(" + text + ", " + Server.rangs[rang] + ")");

			Socket.emit("info", {
				msg: "Bienvenue " + pseudo + " ! (ceci est une alpha)",
				wait: 12000
			});

			console.log("[" + Socket.request.connection.remoteAddress + "] " + pseudo + " vient de se connecter (" + text + ", invité).");
		});
	}
};