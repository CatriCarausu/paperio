var express = require('express');
//require p2 physics library in the server.
var p2 = require('p2'); 
//get the node-uuid package for creating unique id
var unique = require('node-uuid');

var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.get('/css/style.css', function(req, res) {
	res.sendFile(__dirname + '/client/css/style.css');
});
app.get('/assets/explosion.png', function(req, res) {
	res.sendFile(__dirname + '/assets/explosion.png');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 2000);
console.log("Server started.");

var player_lst = [];
var colors = [];
var backgroundColor = 0x00001a;

//needed for physics update 
var startTime = (new Date).getTime();
var lastTime;
var timeStep= 1/70; 

//the physics world in the server. This is where all the physics happens. 
//we set gravity to 0 since we are just following mouse pointers.
var world = new p2.World({
  gravity : [0,0]
});

var land_object = function (startx, starty, color, owner_id, id) {
	this.x = startx;
	this.y = starty;
	this.color = color;
	this.owner_id = owner_id; 
	this.id = id; 
}

//create a game class to store basic game data
var game_setup = function() {
	this.land = generateLandSquares();
	//game size height
	this.canvas_height = 1275;
	//game size width
	this.canvas_width = 720; 
}

// createa a new game instance
var game_instance = new game_setup();

function generateLandSquares() {
	var i, j;
	var land = [];

	for (i = 15; i < 720; i += 30) {
		for (j = 15; j < 1275; j += 30) {
			var unique_id = unique.v4(); 
			var land_obj = new land_object(j, i, backgroundColor, null, unique_id);
			land.push(land_obj);
		}
	}

	return land;
}

//a player class in the server
var Player = function (startX, startY, username) {
	this.id;
	this.username = username;
	this.score = 9;
	this.color = getRndColor();
	this.trailColor = trailColor(this.color);
	this.x = startX;
	this.y = startY;
	this.speed = 500;
	//We need to intilaize with true.
	this.sendData = true;
	this.size = 30; 
	this.dead = false;
	this.trail = [];
}

function addLandForPlayer(player, lastLand, ts) {
	if (!player.trail || player.trail.length === 0){
		return;
	}

	var i, j; 
	var boxBorders = completeBox(player, lastLand);
	completeInsideBorders(boxBorders, player, ts);

	player.trail.forEach( land => {
		var land_item = game_instance.land.find(l => land.id === l.id);
		
		if (land_item.owner_id && land_item.owner_id === player.id) {
			return;
		}

		land_item.x = land.x;
		land_item.y = land.y;
		land_item.owner_id = player.id;
		land_item.color = player.color;

		//set the food data back to client
		ts.emit("item_update", land_item); 
		ts.broadcast.emit("item_update", land_item); 

		player.score++;
	});

	player.trail = [];
}

function completeBox (player, lastLand) {
	var firstLand = player.trail[0];
	var border = player.trail;

	if (lastLand.x === firstLand.x || lastLand.y === firstLand.y) {
		return specialCase(player, lastLand);
	}

	//find owned land to complete box
	var missingBorderFirstLand = game_instance.land.filter(land => land.owner_id === player.id && (
		land.x === firstLand.x || land.y === firstLand.y
	));

	var missingBorderLastLand = game_instance.land.filter(land => land.owner_id === player.id && (	
		land.x === lastLand.x || land.y === lastLand.y
	));

	//findIntersection
	var intersection = missingBorderFirstLand.find(l => missingBorderLastLand.indexOf(l) !== -1);

	if (!intersection) {
		console.log('no intersection');
		return;
	}

	border.push(intersection);

	if (intersection.x === firstLand.x) {
		var start = firstLand.y < intersection.y ? firstLand.y : intersection.y;
		var end = firstLand.y > intersection.y ? firstLand.y : intersection.y;

		for (var y = start; y <= end; y+=30) {
			var missingLand = missingBorderFirstLand.find(l => l.x === intersection.x && l.y === y);
			if (border.indexOf(missingLand) === -1 && missingLand) {
				border.push(missingLand);
			}
		}
	}

	if (intersection.y === firstLand.y) {
		var start = firstLand.x < intersection.x ? firstLand.x : intersection.x;
		var end = firstLand.x > intersection.x ? firstLand.x : intersection.x;

		for (var x = start; x <= end; x+=30) {
			var missingLand = missingBorderFirstLand.find(l => l.y === intersection.y && l.x === x)
			if (border.indexOf(missingLand) === -1 && missingLand) {
				border.push(missingLand);
			}
		}
	}

	if (intersection.x === lastLand.x) {
		var start = lastLand.y < intersection.y ? lastLand.y : intersection.y;
		var end = lastLand.y > intersection.y ? lastLand.y : intersection.y;

		for (var y = start; y <= end; y+=30) {
			var missingLand = missingBorderLastLand.find(l => l.x === intersection.x && l.y === y);
			if (border.indexOf(missingLand) === -1 && missingLand) {
				border.push(missingLand);
			}
		}
	}

	if (intersection.y === lastLand.y) {
		var start = lastLand.x < intersection.x ? lastLand.x : intersection.x;
		var end = lastLand.x > intersection.x ? lastLand.x : intersection.x;

		for (var x = start; x <= end; x+=30) {
			var missingLand = missingBorderLastLand.find(l => l.y === intersection.y && l.x === x);
			if (border.indexOf(missingLand) === -1 && missingLand) {
				border.push(missingLand);
			}
		}
	}

	return border;
}

function specialCase (player, lastLand) {
	var firstLand = player.trail[0];
	var border = player.trail;

	if (lastLand.x === firstLand.x) { 
		var start = firstLand.y < lastLand.y ? firstLand.y : lastLand.y;
		var end = firstLand.y > lastLand.y ? firstLand.y : lastLand.y;

		for (var y = start; y <= end; y+=30) {
			var missingLand = game_instance.land.find(l => l.owner_id === player.id && l.x === lastLand.x && l.y === y);
			if (border.indexOf(missingLand) === -1 && missingLand) {
				border.push(missingLand);
			}
		}
	} else {
		var start = firstLand.x < lastLand.x ? firstLand.x : lastLand.x;
		var end = firstLand.x > lastLand.x ? firstLand.x : lastLand.x;

		for (var x = start; x <= end; x+=30) {
			var missingLand = game_instance.land.find(l => l.owner_id === player.id && l.y === lastLand.y && l.x === x)
			if (border.indexOf(missingLand) === -1 && missingLand) {
				border.push(missingLand);
			}
		}
	}

	return border;
}

function completeInsideBorders (borders, player, ts) {
	borders.forEach(border => {
		var capatX = borders.find(b => b.x === border.x && border.id !== b.id);
		var s, e;

		if (capatX) {
			s = capatX.y < border.y ? capatX.y : border.y;
			e = capatX.y > border.y ? capatX.y : border.y;
			for (var i = s + 30; i < e; i+=30) {
				var land_item = game_instance.land.find(land => land.x === border.x && land.y === i);
				
				if (land_item.owner_id && land_item.owner_id === player.id) {
					continue;
				}
	
				land_item.owner_id = player.id;
				land_item.color = player.color;
		
				//set the food data back to client
				ts.emit("item_update", land_item); 
				ts.broadcast.emit("item_update", land_item); 

				player.score++;
				sortPlayerListByScore();
			}
		}
		
		var capatY = borders.find(b => b.y === border.y && border.id !== b.id);
		
		if (capatY) {
			s = capatY.x < border.x ? capatY.x : border.x;
			e = capatY.x > border.x ? capatY.x : border.x;
			for (var i = s; i <= e; i+=30) {
				var land_item = game_instance.land.find(land => land.y === border.y && land.x === i);
				
				if (land_item.owner_id && land_item.owner_id === player.id) {
					continue;
				}
	
				land_item.owner_id = player.id;
				land_item.color = player.color;
		
				//set the food data back to client
				ts.emit("item_update", land_item);
				ts.broadcast.emit("item_update", land_item); 

				player.score++;
				sortPlayerListByScore();
			}
		}
	});
}

function generateStartingPosition () {
	while (true) {
		var x = getRndInteger(5, 1275/30 - 5);
		var y = getRndInteger(5, 720/30 - 5);

		var i, j;
		var available = true;
		for (i = -1; i <= 1; i++) {
			for (j = -1; j <= 1; j++) {
				var land = game_instance.land.find(l => l.x === (x + i)*30 + 15 && l.y === (y + j)*30 + 15);

				if (!land) {
					continue;
				}

				if (land.owner_id !== null) {
					available = false;
				}
			}
		}

		if(available) {
			return {x: x * 30 + 15, y: y * 30 + 15};
		}
	}
}

function setLandForStarttingPosition (x, y, owner_id, color, ts) {
	var i, j;
	
	for (i = -30; i <= 30; i+=30) {
		for (j = -30; j <= 30; j+=30) {
			var land = game_instance.land.find(l => l.x === x + i && l.y === y + j)
		
			if (!land) {
				continue;
			}

			land.x = x + i;
			land.y = y + j;
			land.owner_id = owner_id;
			land.color = color;

			ts.emit("item_update", land);
			ts.broadcast.emit("item_update", land);
		}
	}
}

// when a new player connects, we make a new instance of the player object,
// and send a new player message to the client. 
function onNewplayer (data) {
	var startingPos = generateStartingPosition();
	
	//new player instance
	var newPlayer = new Player(startingPos.x, startingPos.y, data.username); 	
	newPlayer.id = this.id;

	setLandForStarttingPosition(startingPos.x, startingPos.y, newPlayer.id, newPlayer.color, this);
	
	//create an instance of player body 
	playerBody = new p2.Body ({
		mass: 0,
		position: [startingPos.x, startingPos.y],
		fixedRotation: true
	});
	
	//add the playerbody into the player object 
	newPlayer.playerBody = playerBody;
	world.addBody(newPlayer.playerBody);
	
	console.log("created new player with id " + this.id + " and username " + newPlayer.username);
	newPlayer.id = this.id; 	
	
	this.emit('create_player', {size: newPlayer.size, color: newPlayer.color, x: startingPos.x, y: startingPos.y});
	
	//information to be sent to all clients except sender
	var current_info = {
		id: newPlayer.id, 
		x: newPlayer.x,
		y: newPlayer.y,
		color: newPlayer.color,
		size: newPlayer.size
	}; 
	
	//send to the new player about everyone who is already connected. 	
	for (i = 0; i < player_lst.length; i++) {
		existingPlayer = player_lst[i];
		if (existingPlayer.id === newPlayer.id) {
			continue;
		}
		var player_info = {
			id: existingPlayer.id,
			x: existingPlayer.x,
			y: existingPlayer.y, 
			color: existingPlayer.color,	
			size: existingPlayer.size
		};
		console.log("pushing player");
		//send message to the sender-client only
		this.emit("new_enemyPlayer", player_info);
	}
	
	//send message to every connected client except the sender
	this.broadcast.emit('new_enemyPlayer', current_info);
	
	player_lst.push(newPlayer); 
	sortPlayerListByScore();
}

function onlandPicked(data) {
	var player = player_lst.find(pl => pl.id === data.player_id);
	var currentLand = game_instance.land.find(l => l.id === data.id);
	var nextLand = game_instance.land.find(l => l.x === player.x && l.y === player.y);

	if (!player || !currentLand) {
		return;
	}
	
	if (currentLand.owner_id === data.player_id) {
		return;
	}

	if (!nextLand) {
		var t =  data.ts ? data.ts : this;
		t.emit("killed", {score: player.score});
		//provide the new size the enemy will become
		t.broadcast.emit('remove_player', {id: player.id});
		playerKilled(player, t);
		return;
	}

	checkTailCut(player, data.ts ? data.ts : this);
	checkOtherTailCut(player, data.ts ? data.ts : this, nextLand);

	currentLand.color = trailColor(data.color);
	if (player.trail.indexOf(currentLand) === -1) {
		player.trail.push(currentLand);
	}

	if (data.ts) {
		data.ts.emit("item_update", currentLand);
		data.ts.broadcast.emit("item_update", currentLand);
	} else {
		this.emit("item_update", currentLand);
		this.broadcast.emit("item_update", currentLand);
	}

	if (nextLand.owner_id === data.player_id) {
		addLandForPlayer(player, currentLand, data.ts ? data.ts : this);
	}
}

function checkTailCut(player, ts) {
	if (player.trail.find(l => l.x === player.x && l.y === player.y)) {
		ts.emit("killed", {score: player.score});
		//provide the new size the enemy will become
		ts.broadcast.emit('remove_player', {id: this.id});
		playerKilled(player, ts);
	}
}

function checkOtherTailCut(player, ts, currentLand) {
	var enemy = player_lst.find(player => player.trailColor === currentLand.color);

	if (enemy && enemy.id !== player.id) {
		killEnemy(enemy, ts);
	}
}

function killEnemy (enemyPlayer, ts) {
	if (enemyPlayer.dead) {
		return;
	}

	ts.emit('remove_player', {id: enemyPlayer.id}); 
	ts.broadcast.to(enemyPlayer.id).emit("killed", {score: enemyPlayer.score}); 
	//send to everyone except sender.
	ts.broadcast.emit('remove_player', {id: enemyPlayer.id});
	playerKilled(enemyPlayer, ts);
 
	sortPlayerListByScore();
	console.log("someone ate someone!!!");
}

//instead of listening to player positions, we listen to user inputs 
function onInputFired (data) {
	var movePlayer = find_playerid(this.id, this.room); 
	
	if (!movePlayer || movePlayer.dead) {
		return;
	}

	//when sendData is true, we send the data back to client. 
	if (!movePlayer.sendData) {
		return;
	}
	
	//every 50ms, we send the data. 
	setTimeout(function() {movePlayer.sendData = true}, 50);

	//we set sendData to false when we send the data. 
	movePlayer.sendData = false;
	
	var xAdd = 0, yAdd = 0;
	if (data.direction === 'up') {
		yAdd = -30;
	}
	if (data.direction === 'down') {
		yAdd = 30;
	}
	if (data.direction === 'left') {
		xAdd = -30;
	}
	if (data.direction === 'right') {
		xAdd = 30;
	}

	movePlayer.x = data.pointer_x + xAdd; 
	movePlayer.y = data.pointer_y + yAdd;

	var land = game_instance.land.find(l => l.x === data.pointer_x && l.y === data.pointer_y);

	if (land) {
		onlandPicked({
			id: land.id,
			player_id: movePlayer.id,
			color: movePlayer.color,
			ts: this
		});
	}

	movePlayer.playerBody.position[0] = movePlayer.x;
	movePlayer.playerBody.position[1] = movePlayer.y;
	
	//new player position to be sent back to client. 
	var info = {
		x: movePlayer.playerBody.position[0],
		y: movePlayer.playerBody.position[1]
	}

	//send to sender (not to every clients). 
	this.emit('input_recieved', info);
	
	//data to be sent back to everyone except sender 
	var moveplayerData = {
		id: movePlayer.id, 
		x: movePlayer.playerBody.position[0],
		y: movePlayer.playerBody.position[1],
		size: movePlayer.size,
		color: movePlayer.color
	}
	
	//send to everyone except sender 
	this.broadcast.emit('enemy_move', moveplayerData);
}

function onPlayerCollision (data) {
	var movePlayer = find_playerid(this.id); 
	var enemyPlayer = find_playerid(data.id); 
	
	if (movePlayer.dead || enemyPlayer.dead)
		return
	
	if (!movePlayer || !enemyPlayer)
		return

	//the main player size is less than the enemy size
	//else if (movePlayer.score < enemyPlayer.score) {
		this.emit("killed", {score: movePlayer.score});
		//provide the new size the enemy will become
		this.broadcast.emit('remove_player', {id: this.id});
		playerKilled(movePlayer, this);

	//} else {
		this.emit('remove_player', {id: enemyPlayer.id}); 
		this.broadcast.to(data.id).emit("killed", {score: enemyPlayer.score}); 
		//send to everyone except sender.
		this.broadcast.emit('remove_player', {id: enemyPlayer.id});
		playerKilled(enemyPlayer, this);
	//}
	
	sortPlayerListByScore();
	console.log("someone ate someone!!!");
}

function find_land (id) {
	var land_item = game_instance.land.find(x => x.id === id);
	
	return land_item ? land_item : false;
}

function sortPlayerListByScore() {
	player_lst.sort(function(a,b) {
		return b.score - a.score;
	});
	
	var playerListSorted = [];
	for (var i = 0; i < player_lst.length; i++) {
		playerListSorted.push({id: player_lst[i].id, name: player_lst[i].username, score: player_lst[i].score});
	}

	io.emit("leader_board", playerListSorted);
}

function playerKilled (player, ts) {
	//find the player and remove it.
	var removePlayer = find_playerid(player.id); 
		
	if (removePlayer) {
		removePlayerLand(player, ts);
		player_lst.splice(player_lst.indexOf(removePlayer), 1);
		var index = colors.indexOf(removePlayer.color);
		colors.splice(index, 1);
	}
	
	player.dead = true; 
}

function getRndInteger(min, max) {
	return Math.floor(Math.random() * (max - min + 1) ) + min;
}

//call when a client disconnects and tell the clients except sender to remove the disconnected player
function onClientdisconnect() {
	console.log('disconnect'); 

	var removePlayer = find_playerid(this.id); 
		
	if (removePlayer) {
		removePlayerLand(removePlayer, this);
		player_lst.splice(player_lst.indexOf(removePlayer), 1);
		var index = colors.indexOf(removePlayer.color);
		colors.splice(index, 1);
	}
	
	console.log("removing player " + this.id);
	
	sortPlayerListByScore();
	//send message to every connected client except the sender
	this.broadcast.emit('remove_player', {id: this.id});
}

function removePlayerLand (player, ts) {
	game_instance.land.forEach(land => {
		if(land.owner_id === player.id || land.color === player.trailColor) {
			land.owner_id = null;
			land.color = backgroundColor;

			ts.emit("item_update", land); 
			ts.broadcast.emit("item_update", land); 
		}
	});
}

// find player by the the unique socket id 
function find_playerid(id) {

	for (var i = 0; i < player_lst.length; i++) {

		if (player_lst[i].id == id) {
			return player_lst[i]; 
		}
	}
	
	return false; 
}

function getRndColor() {
	while (true) {
		var color = (Math.random()*0xFFFFFF<<0);

		if (colors.indexOf(color) === -1) {
			colors.push(color);
			return color;
		}
	}
}

function trailColor(color) {
	percent = 0.5;
	var f=color;
	var t=percent<0?0:255;
	var p=percent<0?percent*-1:percent;
	var R=f>>16;
	var G=f>>8&0x00FF;
	var B=f&0x0000FF;
	var lighterColor = parseInt((0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1), 16);
    return lighterColor;
}

function emitInitialLand (ts) {
	game_instance.land.forEach(land => {
		ts.emit("item_update", land);
	});
}

 // io connection 
var io = require('socket.io')(serv, {});

io.sockets.on('connection', function(socket){

	console.log("socket connected"); 
	emitInitialLand(this);
	
	// listen for disconnection; 
	socket.on('disconnect', onClientdisconnect); 
	
	// listen for new player
	socket.on("new_player", onNewplayer);
	
	//listen for new player inputs. 
	socket.on("input_fired", onInputFired);
	
	socket.on("player_collision", onPlayerCollision);
	
	//listen if player got land 
	socket.on('land_picked', onlandPicked);
});