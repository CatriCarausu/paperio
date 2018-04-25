var gOver = function(game){
};

var name, score, message;

gOver.prototype = {
    init: function (data) {
        name = data.name;
        score = data.score;
        message = data.message;
    },

	preload: function() {
        document.getElementById("gameDiv").style.display = 'none';
        document.getElementById("intro").style.display = 'none';
        document.getElementById("gameOver").style.display = 'block';
    },

    create: function() {
        console.log("game over");
        document.getElementById("titleGOver").innerHTML = `${message}, ${name} ${message === "You won" ? '!!!' : ':('}`;
        document.getElementById("scoreLabel").innerHTML = `Your score was: ${score === 880 ? 100 : Math.round(score*100/880*100)/100}%`;
    },

    update: function() {

    }
};

function replay() {
    this.game.state.start("main", true, true, {username: name});
}