var land = [];

// search through food list to find the food object
function finditembyid (id) {
	var landPiece = land.find(x => x.id === id);
	return landPiece ? landPiece : false; 
}

// function called when new food is added in the server.
function onitemUpdate (data) {
	onitemremove(data);
	land.push(new land_object(data.id, data.owner, data.x, data.y, data.color)); 
}

// function called when food needs to be removed in the client. 
function onitemremove (data) {
	var removeItem; 
	removeItem = finditembyid(data.id);

	if (!removeItem) {
		return;
	}

	land.splice(land.indexOf(removeItem), 1); 
	
	//destroy the phaser object 
	removeItem.item.destroy(true, false);
}

// the land class
var land_object = function (id, owner_id, startx, starty, color) {
	// unique id for the food.
	//generated in the server with node-uuid
	this.id = id; 
	this.owner_id = owner_id;
	this.type = "land_object";

	//positinon of the food
	this.posx = startx;  
	this.posy = starty; 
	this.color = color;
	
	//create a circulr phaser object for food
	this.item = game.add.graphics(this.posx, this.posy);
	this.item.beginFill(color);
	this.item.lineStyle(2, color, 1);
	this.item.drawRect(-15, -15, 30, 30);

	this.item.id = id;
}