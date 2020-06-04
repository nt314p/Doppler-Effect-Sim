/*jshint esversion: 6 */

console.log("Hello World!");


var canvas, ctx, audioCtx, oscillator, gainNode;

window.onload = () => {
    canvas = document.getElementById('mainCanvas');
    ctx = canvas.getContext('2d');
    audioCtx = new AudioContext();
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(0);

    if (!step) window.requestAnimationFrame(draw);
};

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    distanceTo(p) {
        return Math.sqrt(Math.pow(this.x - p.x, 2) + Math.pow(this.y - p.y, 2));
    }

    magnitude() {
        return this.distanceTo(new Point(0, 0));
    }

    add(p) {
        this.x += p.x;
        this.y += p.y;
    }

    delta(newP) {
        return new Point(newP.x - this.x, newP.y - this.y);
    }

    clone() {
        return new Point(this.x, this.y);
    }
}

var i = 1200;

var step = false;

var freqS = 660;
var observer = new Point(50, 0);
var source = new Point(-200, 20);
var prevT = new Date();
var prevD = source.distanceTo(observer);

function draw() {
    var currT = new Date(); // delta time
    var dT = (currT - prevT) / 1000;
    prevT = currT;


    var dD = prevD - source.distanceTo(observer); // delta displacement
    console.log("dist: " + source.distanceTo(observer));
    console.log("dD: " + dD);
    console.log("vS: " + (dD / dT));
    console.log("fps: " + (1/dT));
    prevD = source.distanceTo(observer);

    source.add(new Point(100 * dT, 0));


    updateSound(doppler(freqS, 340, (dD / dT)), 0.1);

    console.log("x: " + source.x);
    if (!step) window.requestAnimationFrame(draw);
}

// params: f_source, v_medium (v_sound in medium), v_source (relative to observer)
// returns: f_doppler
function doppler(fS, vM, vS) {
    return (vM * fS) / (vM - vS);
}

function updateSound(frequency, gain) {
    oscillator.frequency.value = frequency;
    gainNode.gain.value = gain;
}


