var express = require('express');
//require p2 physics library in the server.
var p2 = require('p2'); 
//get the node-uuid package for creating unique id
var unique = require('node-uuid')

var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 2000);
console.log("Server started.");

var player_lst = [];
var colors = [];
var backgroundColor = 0x00001a;
// 0xb3ff66;

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
var Player = function (startX, startY) {
	this.id;
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

//We call physics handler 60fps. The physics is calculated here. 
setInterval(heartbeat, 1000/60);

//Steps the physics world. 
function physics_hanlder() {
	var currentTime = (new Date).getTime();
	timeElapsed = currentTime - startTime;
	var dt = lastTime ? (timeElapsed - lastTime) / 1000 : 0;
    dt = Math.min(1 / 10, dt);
    world.step(timeStep);
}

function heartbeat () {
	physics_hanlder();
}

function addLandForPlayer(player, lastLand) {
	var i, j; 

	completeBox(player, lastLand);

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
		io.emit("item_update", land_item); 

		completeRowAndCol(land_item, player, lastLand);
	});

	player.trail = [];
}

function completeBox (currentLand, player, lastLand) {
	var lastSameX = findLastWithSameX(player, currentLand.x, currentLand.y, lastLand);
	var lastSameY = findLastWithSameY(player, currentLand.x, currentLand.y, lastLand);
	var start, end;

	if (lastSameX) {
		start = currentLand.y < lastSameX.y ? currentLand.y : lastSameX.y;
		end = currentLand.y > lastSameX.y ? currentLand.y : lastSameX.y;
		for (var i = start; i <= end; i+=30) {
			var land_item = game_instance.land.find(l => l.x === currentLand.x && l.y === i);

			if (land_item.owner_id && land_item.owner_id === player.id) {
				continue;
			}
			
			land_item.x = currentLand.x;
			land_item.y = i;
			land_item.owner_id = player.id;
			land_item.color = player.color;

			//set the food data back to client
			io.emit("item_update", land_item); 
		}
	}

	if (lastSameY) {
		start = currentLand.x < lastSameY.x ? currentLand.x : lastSameY.x;
		end = currentLand.x > lastSameY.x ? currentLand.x : lastSameY.x;
		for (var i = start; i <= end; i+=30) {
			var land_item = game_instance.land.find(l => l.y === currentLand.y && l.x === i);
			
			if (land_item.owner_id && land_item.owner_id === player.id) {
				continue;
			}
	
			land_item.y = currentLand.y;
			land_item.x = i;
			land_item.owner_id = player.id;
			land_item.color = player.color;
	
			//set the food data back to client
			io.emit("item_update", land_item); 
		}
	}
	
}

function findLastWithSameX (player, x, y, lastLand) {
	

	var sameX = game_instance.land.filter(t => t.x === x && t.owner_id === player.id);
	var max = 100000, i;
	var land;

	sameX.forEach(s => {
		if (Math.abs(s.y - y) < max) {
			land = s;
			max = s.y;
		}
	});

	return land;
}

function findLastWithSameY (player, x, y, lastLand) {	
	var sameX = game_instance.land.filter(t => t.y === y && t.owner_id === player.id);
	var max = 1000000, i;
	var land;

	sameX.forEach(s => {
		if (Math.abs(s.x - x) < max) {
			land = s;
			max = s.x;
		}
	});

	return land;
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

			ts.emit("item_update", land)
		}
	}
}

// when a new player connects, we make a new instance of the player object,
// and send a new player message to the client. 
function onNewplayer (data) {
	var startingPos = generateStartingPosition();
	
	//new player instance
	var newPlayer = new Player(startingPos.x, startingPos.y);
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
	
	console.log("created new player with id " + this.id);
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

	if (!player || !currentLand) {
		return;
	}

	if (currentLand.owner_id === data.player_id) {
		addLandForPlayer(player, currentLand);
		return;
	}
	
	currentLand.color = trailColor(data.color);
	player.trail.push(currentLand);

	if (data.ts) {
		data.ts.emit("item_update", currentLand);
	} else {
		this.emit("item_update", currentLand);
	}
}

//instead of listening to player positions, we listen to user inputs 
function onInputFired (data) {
	var movePlayer = find_playerid(this.id, this.room); 
	
	if (!movePlayer || movePlayer.dead) {
		return;
		console.log('no player'); 
	}

	//when sendData is true, we send the data back to client. 
	if (!movePlayer.sendData) {
		return;
	}

	onlandPicked({
		id: game_instance.land.find(l => l.x === data.pointer_x && l.y === data.pointer_y).id,
		player_id: movePlayer.id,
		color: movePlayer.color,
		ts: this
	});
	
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
		size: movePlayer.size
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
	
	if (movePlayer.size == enemyPlayer)
		return

	//the main player size is less than the enemy size
	else if (movePlayer.size < enemyPlayer.size) {
		var gained_size = movePlayer.size / 2;
		enemyPlayer.size += gained_size; 
		this.emit("killed");
		//provide the new size the enemy will become
		this.broadcast.emit('remove_player', {id: this.id});
		playerKilled(movePlayer);

	} else {
		var gained_size = enemyPlayer.size / 2;
		movePlayer.size += gained_size;
		this.emit('remove_player', {id: enemyPlayer.id}); 
		this.broadcast.to(data.id).emit("killed"); 
		//send to everyone except sender.
		this.broadcast.emit('remove_player', {id: enemyPlayer.id});
		playerKilled(enemyPlayer);
	}
	
	sortPlayerListByScore();
	console.log("someone ate someone!!!");
}

function find_land (id) {
	var land_item = game_instance.land.find(x => x.id === id);
	
	return land_item ? land_item : false;
}

function sortPlayerListByScore() {
	player_lst.sort(function(a,b) {
		return b.size - a.size;
	});
	
	var playerListSorted = [];
	for (var i = 0; i < player_lst.length; i++) {
		playerListSorted.push({id: player_lst[i].id, size: player_lst[i].size});
	}
	console.log(playerListSorted);
	io.emit("leader_board", playerListSorted);
}

function playerKilled (player) {
	//find the player and remove it.
	var removePlayer = find_playerid(player.id); 
		
	if (removePlayer) {
		removePlayerLand(player);
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
		removePlayerLand(removePlayer);
		player_lst.splice(player_lst.indexOf(removePlayer), 1);
		var index = colors.indexOf(removePlayer.color);
		colors.splice(index, 1);
	}
	
	console.log("removing player " + this.id);
	
	sortPlayerListByScore();
	//send message to every connected client except the sender
	this.broadcast.emit('remove_player', {id: this.id});
}

function removePlayerLand (player) {
	game_instance.land.forEach(land => {
		if(land.owner_id === player.id || land.color === player.trailColor) {
			land.owner_id = null;
			land.color = backgroundColor;
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
var io = require('socket.io')(serv,{});

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