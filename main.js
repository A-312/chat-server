var fs = require("fs"),
	http = require("http");

var Listener = require("./listener.js");
var Server = require("./server.js");

(function() {
	process.stdout.write("\x1Bc");
	Server.sendMessage("Serveur", "Lancement " + require('moment')().locale('fr').format("LLLL:ss") + ".");

	if (fs.existsSync("CHANGELOG")) {
		var str = fs.readFileSync("CHANGELOG") + "";
		Server.changes = str.split("\n");
		for (var i = 0; i < Server.changes.length; i++) {
			Server.sendMessage("Information", i + ": " + Server.changes[i]);
		}
	}

	var rl = require("readline").createInterface(process.stdin, process.stdout);
	rl.on("close", Server.exit);

	process.on("uncaughtException", Server.uncaughtException);

	/*var serverHTTP = http.createServer(function(req, res) {
		res.writeHead(200, {
			"X-Powered-By": "du-chocolat",
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "private",
			"ETag": 12
		});
		var msg = "[" + req.connection.remoteAddress + "] (õ_o) < I see you ! ";
		if (req.headers["if-none-match"] == "12") {
			res.statusCode = 404;
		}
		console.log(msg, res.statusCode);
		res.end(msg);

		console.log(req.headers);
	}).listen(Server.port);*/

	//Server.app = require("express")();
	//Server.serverHTTP = Server.app.listen(Server.port),
	//Server.IO = require("socket.io").listen(Server.serverHTTP);

	Server.IO = require("socket.io").listen(Server.port);
	console.log(">> Port : " + Server.port);

	Server.load();

	Server.Chat = Server.IO.of("/chat").on("connection", function(Socket) {
		Listener.listener(Socket);
	});
})();

setInterval(function() {
	var msgLog = "";
	for (var i in Server.clients) {
		msgLog += (msgLog != "") ? ", " : "";
		msgLog += "[" + i + "]" + Server.clients[i].pseudo;
	}
	if (msgLog != "") {
		var length = Server.clients.filter(Object).length,
			guest = Server.guest - length;
		var s = (length < 2) ? " " : "s",
			x = (guest < 2) ? " " : "s";
		console.log(">> " + length + " client" + s + " : " + msgLog + ((guest > 0) ? "  + " + guest + " invité" + x : ""));
	} else {
		console.log("Server running on " + Server.port + "...");
	}
}, 3000);