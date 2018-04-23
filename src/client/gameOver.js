var gOver = function(game){
};

var name;
var score;

gOver.prototype = {
    init: function (data) {
        name = data.name;
        score = data.score;
    },

	preload: function() {
        document.getElementById("gameDiv").style.display = 'none';
        document.getElementById("intro").style.display = 'none';
        document.getElementById("gameOver").style.display = 'block';
    },

    create: function() {
        console.log("game over");
        document.getElementById("titleGOver").innerHTML = `Game over, ${name} :(`;
        document.getElementById("scoreLabel").innerHTML = `Your score was: ${score}`;
    },

    update: function() {

    }
};

function replay() {
    this.game.state.start("main", true, true, {username: name});
}