var socket;

canvas_width = 1500; // window.innerWidth * window.devicePixelRatio;
canvas_height = 720; // window.innerHeight * window.devicePixelRatio;

game = new Phaser.Game(canvas_width, canvas_height, Phaser.CANVAS, 'gameDiv');

//the enemy player list 
var enemies = [];
var userName;

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
	socket.emit('new_player', {username: userName});
}

// When the server notifies us of client disconnection, we find the disconnected
// enemy and remove from our game
function onRemovePlayer (data) {
	var removePlayer = findplayerbyid(data.id);
	// Player not found
	if (!removePlayer) {
		console.log('Player not found: ', data.id);
		return;
	}
	
	setTimeout(() => {
		removePlayer.player.destroy();
		var explosion = game.add.sprite(removePlayer.x - 256/2, removePlayer.y - 256/2, "explosion");
		explosion.animations.add('explode');
		explosion.animations.play('explode', 28, false);
		enemies.splice(enemies.indexOf(removePlayer), 1);
		
		setTimeout(() => {
			explosion.destroy();
		}, 1700);
	}, 150);	
}

function createPlayer (data) {
	player = game.add.graphics(data.x, data.y);

	// set a fill and line style
	player.beginFill(data.color);
	player.lineStyle(2, 0xffffff, 1);
	player.drawRect(-data.size/2, -data.size/2, data.size, data.size);
	player.endFill();

	player.color = data.color;
	player.type = "player_body"; 

	var style = { font: "16px Arial", fill: "#ffffff", wordWrap: false, align: "center" };
	
	text = game.add.text(0, 0, userName, style);
	text.anchor.set(0.5);

    text.x = Math.floor(data.x + data.size / 2);
    text.y = Math.floor(data.y - data.size / 2 - 10);

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
	
	this.player = game.add.graphics(startx , starty);

	// set a fill and line style
	this.player.beginFill(color);
    this.player.lineStyle(2, 0xffffff, 1);
	this.player.drawRect(-startSize / 2, -startSize / 2 , startSize, startSize);
	this.player.endFill();

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
	var new_enemy = new remote_player(data.id, data.x, data.y, data.size, data.color); 
	enemies.push(new_enemy);
}

//Server tells us there is a new enemy movement. We find the moved enemy
//and sync the enemy movement with the server
function onEnemyMove (data) {
	var movePlayer = findplayerbyid(data.id); 
	var index = enemies.findIndex(x => x.id === data.id);
	
	if (!movePlayer) {
		return;
	}
	
	var playerData = {
		id: data.id, 
		color: data.color,
		size: 30,
		x: data.x, 
		y: data.y, 
	}

	movePlayer.player.destroy();
	enemies.splice(index, 1);
	onNewPlayer(playerData);
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
	text.destroy();
	createPlayer(playerData);

}

function onKilled (data) {
	setTimeout(() => {
		text.destroy();
		player.destroy();
		var expl = game.add.sprite(player.x - 256/2, player.y - 256/2, "explosion");
		expl.animations.add('explode');
		expl.animations.play('explode', 28, false);
		
		setTimeout(() => {
			expl.destroy();
			game.state.start("gameOver", true, true, {name: userName, score: data.score});
		}, 1700);
	}, 150);	
}

//This is where we use the socket id. 
//Search through enemies list to find the right enemy of the id.
function findplayerbyid (id) {
	return enemies.find(x => x.id == id); 
}

//create leader board in here.
function createLeaderBoard() {
	var leaderBox = game.add.graphics(game.width * 0.85, game.height * 0.02);
	leaderBox.fixedToCamera = true;
	// draw a rectangle
	leaderBox.beginFill(0xd1f2eb, 1);
    leaderBox.lineStyle(5, 0x117864, 1);
    leaderBox.drawRect(0, 0, 210, 700);
	
	var style = { font: "Calibri", fill: "#117864", align: "left", fontSize: '23px', fontWeight: 'bold'};
	
	leader_text = game.add.text(10, 10, "Leaderboard", style);
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
		var username = data[i].name;
		if (data[i].name.length >= 10) {
			var temp = ""; 
			for (var j = 0; j < maxlen; j++) {
				temp += username[j];
			}
			
			temp += "...";
			username = temp;
		}
		
		board_string = board_string.concat(i + 1, ". ", username,"   ",(Math.round(data[i].score*100/880*100)/100).toString() + "%\n");
		
	}
	
	leader_text.setText("Leaderboard: \n" + board_string); 
}

main.prototype = {
	init: function (data) {
		userName = data.username;
	},

	preload: function() {
		game.load.spritesheet('explosion', 'assets/explosion3.png', 256, 256, 32);

		document.getElementById("gameDiv").style.display = 'block';
        document.getElementById("gameOver").style.display = 'none';
		document.getElementById("intro").style.display = 'none';

		game.stage.disableVisibilityChange = true;
		game.scale.scaleMode = Phaser.ScaleManager.RESIZE;
		game.world.setBounds(0, 0, gameProperties.gameWidth, gameProperties.gameHeight, false, false, false, false);
		game.physics.startSystem(Phaser.Physics.P2JS);
		game.physics.p2.setBoundsToWorld(true, true, true, true, false)
		game.physics.p2.gravity.y = 0;
		game.physics.p2.applyGravity = false; 
		game.physics.p2.enableBody(game.physics.p2.walls, false);
		
    },
	
	create: function () {
		socket = io({transports: ['websocket'], upgrade: false});
		game.stage.backgroundColor = 0x191930; 
		
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
		game.state.add('login', login);
		game.state.add('gameOver', gOver);
		game.state.start('login'); 
    }
};

gameManager.init("gameDiv");