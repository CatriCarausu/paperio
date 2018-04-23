var login = function(game){
};

login.prototype = {
	preload: function() {
        document.getElementById("gameDiv").style.display = 'none';
        document.getElementById("intro").style.display = 'block';
        document.getElementById("gameOver").style.display = 'none';
    },

    create: function() {
        
		var playButton = this.game.add.button(160,320,"play",this.playTheGame,this);
		playButton.anchor.setTo(0.5,0.5);
    },

    update: function() {

    }
};

function playTheGame() {
    var name = document.getElementById("usernameInput").value;
    
    if (name.length === 0) {
        alert("Please fill in you name first!");
        return;
    } 

    this.game.state.start("main", true, true, {username: name});
}