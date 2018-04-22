var socket = io({transports: ['websocket'], upgrade: false});


canvas_width = 1500 - 15; // window.innerWidth * window.devicePixelRatio;
canvas_height = 720; // window.innerHeight * window.devicePixelRatio;

game = new Phaser.Game(canvas_width, canvas_height, Phaser.CANVAS, 'gameDiv');

//the enemy player list 
var enemies = [];

var gameProperties = { 
	gameWidth: 1500 - 15,
	gameHeight: 720,
	game_elemnt: "gameDiv",
	in_game: false,
};

var main = function(game){
};

function onsocketConnected () {
	console.log("connected to server"); 
	gameProperties.in_game = true;
	// send the server our initial position and tell it we are connected
	socket.emit('new_player', {x: 0, y: 0});
}

// When the server notifies us of client disconnection, we find the disconnected
// enemy and remove from our game
function onRemovePlayer (data) {
	var removePlayer = findplayerbyid(data.id);
	// Player not found
	if (!removePlayer) {
		console.log('Player not found: ', data.id)
		return;
	}
	
	removePlayer.player.destroy();
	enemies.splice(enemies.indexOf(removePlayer), 1);
}

function createPlayer (data) {
	player = game.add.graphics(data.x, data.y);

	// set a fill and line style
	player.beginFill(data.color);
	player.lineStyle(2,0xffffff, 1);
	player.drawRect(-data.size/2, -data.size/2, data.size, data.size);
	player.endFill();

	player.color = data.color;
	player.type = "player_body"; 

	// draw a shape
	game.physics.p2.enableBody(player, false);

	//enable collision and when it makes a contact with another body, call player_coll
	player.body.onBeginContact.add(player_coll, this); 
	
	//camera follow
	game.camera.follow(player, Phaser.Camera.FOLLOW_LOCKON, 0.5, 0.5);
}

//get random intenger
function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1) ) + min;
}

// this is the enemy class. 
var remote_player = function (id, startx, starty, startSize, color) {
	this.x = startx;
	this.y = starty;
	//this is the unique socket id. We use it as a unique name for enemy
	this.id = id;
	
	this.player = game.add.graphics(this.x , this.y);

	// set a fill and line style
	player.beginFill(color, 1);
    player.lineStyle(2, "#000000", 1);
	player.drawRect(-startSize / 2, -startSize / 2 , startSize, startSize);
	player.endFill();

	//we set the initial size;
	this.initial_size = startSize;
	this.player.type = "player_body";
	this.player.id = this.id;
	this.player.color = color;

	// draw a shape
	game.physics.p2.enableBody(this.player, false);
}

//Server will tell us when a new enemy player connects to the server.
//We create a new enemy in our game.
function onNewPlayer (data) {
	//enemy object 
	console.log(data);
	var new_enemy = new remote_player(data.id, data.x, data.y, data.size, data.color); 
	enemies.push(new_enemy);
}

//Server tells us there is a new enemy movement. We find the moved enemy
//and sync the enemy movement with the server
function onEnemyMove (data) {
	var movePlayer = findplayerbyid(data.id); 
	
	if (!movePlayer) {
		return;
	}
	
	//check if the server enemy size is not equivalent to the client
	if (data.size != movePlayer.player.body_size) {
		movePlayer.player.body_size = data.size; 
	}

	game.physics.arcade.moveToXY(movePlayer.player, data.x, data.y, 125);
}

//we're receiving the calculated position from the server and changing the player position
function onInputRecieved (data) {	
	// game.physics.arcade.moveToXY(player, data.x, data.y);
	var playerData = {
		color: player.color,
		size: 30,
		x: data.x, 
		y: data.y, 
	}

	player.destroy();
	createPlayer(playerData);

}

function onKilled (data) {
	player.destroy();
}

//This is where we use the socket id. 
//Search through enemies list to find the right enemy of the id.
function findplayerbyid (id) {
	return enemies.find(x => x.id == id); 
}

//create leader board in here.
function createLeaderBoard() {
	var leaderBox = game.add.graphics(game.width * 0.86, game.height * 0.02);
	leaderBox.fixedToCamera = true;
	// draw a rectangle
	leaderBox.beginFill(0xD3D3D3, 0.3);
    leaderBox.lineStyle(2, 0x202226, 1);
    leaderBox.drawRect(0, 0, 220, 220);
	
	var style = { font: "Calibri", fill: "white", align: "left", fontSize: '22px'};
	
	leader_text = game.add.text(10, 10, "", style);
	leader_text.anchor.set(0);

	leaderBox.addChild(leader_text);
}

//leader board
function lbupdate (data) {
	//this is the final board string.
	var board_string = ""; 
	var maxlen = 10;
	var maxPlayerDisplay = 10;
	var mainPlayerShown = false;
	
	for (var i = 0;  i < data.length; i++) {
		//if the mainplayer is shown along the iteration, set it to true
	
		if (mainPlayerShown && i >= maxPlayerDisplay) {
			break;
		}
		
		//if the player's rank is very low, we display maxPlayerDisplay - 1 names in the leaderboard
		// and then add three dots at the end, and show player's rank.
		if (!mainPlayerShown && i >= maxPlayerDisplay - 1 && socket.id == data[i].id) {
			board_string = board_string.concat(".\n");
			board_string = board_string.concat(".\n");
			board_string = board_string.concat(".\n");
			mainPlayerShown = true;
		}
		
		//here we are checking if user id is greater than 10 characters, if it is 
		//it is too long, so we're going to trim it.
		if (data[i].id.length >= 10) {
			var username = data[i].id;
			var temp = ""; 
			for (var j = 0; j < maxlen; j++) {
				temp += username[j];
			}
			
			temp += "...";
			username = temp;
		
			board_string = board_string.concat(i + 1,": ");
			board_string = board_string.concat(username," ",(data[i].score).toString() + "\n");
		
		} else {
			board_string = board_string.concat("\n");
		}
		
	}
	
	console.log(board_string);
	leader_text.setText(board_string); 
}

main.prototype = {
	preload: function() {
		game.stage.disableVisibilityChange = true;
		game.scale.scaleMode = Phaser.ScaleManager.RESIZE;
		game.world.setBounds(0, 0, gameProperties.gameWidth, gameProperties.gameHeight, false, false, false, false);
		game.physics.startSystem(Phaser.Physics.P2JS);
		game.physics.p2.setBoundsToWorld(false, false, false, false, false)
		game.physics.p2.gravity.y = 0;
		game.physics.p2.applyGravity = false; 
		game.physics.p2.enableBody(game.physics.p2.walls, false); 
		// physics start system
		//game.physics.p2.setImpactEvents(true);

    },
	
	create: function () {
		game.physics.startSystem(Phaser.Physics.ARCADE);
		// game.stage.backgroundColor = "#f5fff4";
		
		console.log("client started");
		socket.on("connect", onsocketConnected); 
		
		//listen for main player creation
		socket.on("create_player", createPlayer);
		//listen to new enemy connections
		socket.on("new_enemyPlayer", onNewPlayer);
		//listen to enemy movement 
		socket.on("enemy_move", onEnemyMove);
		//when received remove_player, remove the player passed; 
		socket.on('remove_player', onRemovePlayer); 
		//when the player receives the new input
		socket.on('input_recieved', onInputRecieved);
		//when the player gets killed
		socket.on('killed', onKilled);

		// check for item removal
		socket.on ('itemremove', onitemremove); 
		// check for item update
		socket.on('item_update', onitemUpdate); 
		// check for leaderboard
		socket.on ('leader_board', lbupdate); 
		
		createLeaderBoard();
	},
	
	update: function () {
		// emit the player input
		//move the player when the player is made 

		document.addEventListener('keyup', function(e) {
			if (!gameProperties.in_game) {
				return;
			}

			if ((e.keyCode || e.which) == 37) { //left
				socket.emit('input_fired', {
					pointer_x: player.body.x, 
					pointer_y: player.body.y,
					direction: 'left'
				});
			}

			if ((e.keyCode || e.which) == 39) { //right
				socket.emit('input_fired', {
					pointer_x: player.body.x, 
					pointer_y: player.body.y,
					direction: 'right'
				});
			}

			if ((e.keyCode || e.which) == 38) { //up
				socket.emit('input_fired', {
					pointer_x: player.body.x, 
					pointer_y: player.body.y,
					direction: 'up'
				});
			}

			if ((e.keyCode || e.which) == 40) { //down
				socket.emit('input_fired', {
					pointer_x: player.body.x, 
					pointer_y: player.body.y,
					direction: 'down'
				});
			}

		}, true);

		// if (gameProperties.in_game) {

		// 	if (game.input.keyboard.isDown(Phaser.Keyboard.LEFT)) {
		// 		socket.emit('input_fired', {
		// 			pointer_x: player.body.x - 30, 
		// 			pointer_y: player.body.y 
		// 		});
		// 	}

		// 	if (game.input.keyboard.isDown(Phaser.Keyboard.RIGHT)) {
		// 		socket.emit('input_fired', {
		// 			pointer_x: player.body.x + 30, 
		// 			pointer_y: player.body.y
		// 		});
		// 	}

		// 	if (game.input.keyboard.isDown(Phaser.Keyboard.UP)) {
		// 		socket.emit('input_fired', {
		// 			pointer_x: player.body.x, 
		// 			pointer_y: player.body.y - 30
		// 		});
		// 	}

		// 	if (game.input.keyboard.isDown(Phaser.Keyboard.DOWN)) {
		// 		socket.emit('input_fired', {
		// 			pointer_x: player.body.x, 
		// 			pointer_y: player.body.y + 30
		// 		});
		// 	}
		// }
	}
}

var gameManager = {
    init: function(gameContainerElementId){
		game.state.add('main', main);
		game.state.start('main'); 
    }
};

gameManager.init("gameDiv");